#!/usr/bin/env python3
"""
VRM(GLB) 경량화 스크립트 — 제품 배포용.

VRoid 내보내기는 14MB에 달한다. 원인 둘:
1) 2048px 텍스처 여러 장 → 최대 px로 축소 + 256색 양자화(VRoid 텍스처는 평면 셰이딩이라 손실 미미)
2) 얼굴 모프 타깃 약 400개가 밀집 저장 → VRM 표정(expressions)이 실제로 참조하는 타깃만 남긴다
   (우리가 쓰는 건 눈 깜빡임·입·미소 몇 개지만 VRM 규격의 표정 프리셋은 전부 보존한다)

메시·본·VRMC_vrm/springBone 확장은 그대로 둔다. 범용 도구(gltf-transform)는 VRM 확장을
떨어뜨릴 수 있어 직접 다룬다.

사용: python3 scripts/slim-vrm.py <입력.vrm> <출력.vrm> [최대px=1024]
"""
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
max_px = int(sys.argv[3]) if len(sys.argv) > 3 else 1024

with open(src, "rb") as f:
    magic, version, _ = struct.unpack("<III", f.read(12))
    assert magic == 0x46546C67, "GLB 아님"
    jlen, jtype = struct.unpack("<II", f.read(8))
    gltf = json.loads(f.read(jlen))
    blen, btype = struct.unpack("<II", f.read(8))
    blob = f.read(blen)

meshes, nodes, accessors, views = gltf["meshes"], gltf["nodes"], gltf["accessors"], gltf["bufferViews"]
vrm = gltf["extensions"]["VRMC_vrm"]
expr_groups = list(vrm.get("expressions", {}).get("preset", {}).values()) + \
              list(vrm.get("expressions", {}).get("custom", {}).values())

# ── 1) 표정이 참조하는 (mesh, morph index)만 남기고 인덱스 재매핑 ──
used = {}  # mesh index -> set(morph index)
for e in expr_groups:
    for b in e.get("morphTargetBinds", []):
        mi = nodes[b["node"]].get("mesh")
        if mi is not None:
            used.setdefault(mi, set()).add(b["index"])

remap = {}  # (mesh, old) -> new
dropped = 0
for mi, mesh in enumerate(meshes):
    keep = sorted(used.get(mi, set()))
    for p in mesh["primitives"]:
        targets = p.get("targets")
        if not targets:
            continue
        dropped += len(targets) - len(keep)
        p["targets"] = [targets[i] for i in keep]
    for new, old in enumerate(keep):
        remap[(mi, old)] = new
    if "weights" in mesh:
        mesh["weights"] = [mesh["weights"][i] for i in keep]
    names = mesh.get("extras", {}).get("targetNames")
    if names:
        mesh["extras"]["targetNames"] = [names[i] for i in keep]
for e in expr_groups:
    for b in e.get("morphTargetBinds", []):
        mi = nodes[b["node"]].get("mesh")
        b["index"] = remap[(mi, b["index"])]

# ── 2) 남은 참조만 따라 accessor / bufferView 압축 ──
def walk_accessor_refs():
    for mesh in meshes:
        for p in mesh["primitives"]:
            yield from p["attributes"].values()
            if "indices" in p: yield p["indices"]
            for t in p.get("targets", []): yield from t.values()
    for s in gltf.get("skins", []):
        if "inverseBindMatrices" in s: yield s["inverseBindMatrices"]
    for a in gltf.get("animations", []):
        for smp in a["samplers"]:
            yield smp["input"]; yield smp["output"]

acc_keep = sorted(set(walk_accessor_refs()))
acc_map = {old: new for new, old in enumerate(acc_keep)}
img_view = {img["bufferView"] for img in gltf.get("images", []) if "bufferView" in img}
view_keep = sorted({accessors[a]["bufferView"] for a in acc_keep if "bufferView" in accessors[a]} | img_view)
view_map = {old: new for new, old in enumerate(view_keep)}

new_blob = bytearray(); shrunk = 0; new_views = []
for old in view_keep:
    bv = views[old]
    data = blob[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
    if old in img_view:
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        if max(im.size) > max_px:
            im.thumbnail((max_px, max_px), Image.LANCZOS)
        im = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        out = io.BytesIO(); im.save(out, format="PNG", optimize=True); data = out.getvalue(); shrunk += 1
    while len(new_blob) % 4: new_blob += b"\0"
    nv = {k: v for k, v in bv.items() if k not in ("byteOffset", "byteLength")}
    nv["byteOffset"] = len(new_blob); nv["byteLength"] = len(data)
    new_views.append(nv); new_blob += data
while len(new_blob) % 4: new_blob += b"\0"

new_acc = []
for old in acc_keep:
    a = dict(accessors[old])
    if "bufferView" in a: a["bufferView"] = view_map[a["bufferView"]]
    new_acc.append(a)
for mesh in meshes:
    for p in mesh["primitives"]:
        p["attributes"] = {k: acc_map[v] for k, v in p["attributes"].items()}
        if "indices" in p: p["indices"] = acc_map[p["indices"]]
        p["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in p.get("targets", [])] or p.get("targets")
        if not p.get("targets"): p.pop("targets", None)
for s in gltf.get("skins", []):
    if "inverseBindMatrices" in s: s["inverseBindMatrices"] = acc_map[s["inverseBindMatrices"]]
for a in gltf.get("animations", []):
    for smp in a["samplers"]:
        smp["input"] = acc_map[smp["input"]]; smp["output"] = acc_map[smp["output"]]
for img in gltf.get("images", []):
    if "bufferView" in img: img["bufferView"] = view_map[img["bufferView"]]

gltf["accessors"], gltf["bufferViews"] = new_acc, new_views
gltf["buffers"][0]["byteLength"] = len(new_blob)

jbytes = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
while len(jbytes) % 4: jbytes += b" "
with open(dst, "wb") as f:
    f.write(struct.pack("<III", magic, version, 12 + 8 + len(jbytes) + 8 + len(new_blob)))
    f.write(struct.pack("<II", len(jbytes), jtype)); f.write(jbytes)
    f.write(struct.pack("<II", len(new_blob), btype)); f.write(new_blob)

print(f"모프 타깃 {dropped}개 제거 · 텍스처 {shrunk}장 처리 · 버퍼 {len(blob)/1048576:.1f}MB → {len(new_blob)/1048576:.1f}MB")
