#!/usr/bin/env python3
"""Scale PolyTrack v0.6.3 engine force (default 4000) in polytrack_physics.wasm.
Usage: python3 patch_speed.py polytrack_physics.wasm [multiplier]   (default 1.5)
Writes polytrack_physics.patched.wasm next to the input. Original is never modified."""
import struct, sys
path = sys.argv[1]
mult = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5
data = open(path, 'rb').read()
pat = b'\x43' + struct.pack('<f', 4000.0)          # f32.const 4000
if data.count(pat) != 1:
    sys.exit(f"Expected exactly 1 match for the engine force constant, found {data.count(pat)} "
             "(different game version or already patched).")
i = data.index(pat)
out = bytearray(data)
out[i+1:i+5] = struct.pack('<f', 4000.0 * mult)
dst = path.replace('.wasm', '.patched.wasm')
open(dst, 'wb').write(out)
print(f"Engine force 4000 -> {4000.0*mult:g} written to {dst}")
