import os
from PIL import Image, ImageFilter
import numpy as np

src_path = r'C:\Users\Nguyen Trong Phuc\Downloads\Modify_logo_to_red_flame_202608140956 - Copy.jpeg'
if not os.path.exists(src_path):
    src_path = 'public/logo.png'

print(f"Loading {src_path}...")
img = Image.open(src_path).convert('RGB')
arr = np.array(img, dtype=np.int32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

# 1. Detect red flame
is_red = (r > 85) & (r > g + 35) & (r > b + 35)

# Calculate alpha: smooth alpha on edges
# For red pixels, alpha is proportional to red dominance
redness = np.clip((r - np.maximum(g, b) - 20) / 40.0, 0.0, 1.0)
alpha = (redness * 255).astype(np.uint8)

# Construct RGBA
out_arr = np.zeros((img.height, img.width, 4), dtype=np.uint8)
out_arr[:, :, 0] = arr[:, :, 0]  # R
out_arr[:, :, 1] = arr[:, :, 1]  # G
out_arr[:, :, 2] = arr[:, :, 2]  # B
out_arr[:, :, 3] = alpha         # A

out_img = Image.fromarray(out_arr, 'RGBA')
bbox = out_img.getbbox()
print("Bounding box:", bbox)

if bbox:
    cropped = out_img.crop(bbox)
    
    # Target size: 1024x1024 with 6% padding
    size = 1024
    pad = int(size * 0.06)
    target_size = size - 2 * pad
    
    cw, ch = cropped.size
    scale = min(target_size / cw, target_size / ch)
    new_w, new_h = int(cw * scale), int(ch * scale)
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    final_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    paste_x = (size - new_w) // 2
    paste_y = (size - new_h) // 2
    final_img.paste(resized, (paste_x, paste_y), resized)
    
    os.makedirs('public', exist_ok=True)
    os.makedirs('src/assets', exist_ok=True)
    os.makedirs('src-tauri/icons', exist_ok=True)
    
    final_img.save('public/logo.png')
    final_img.save('src/assets/logo.png')
    final_img.save('src-tauri/icons/icon.png')
    print("SUCCESS: Generated 1024x1024 transparent icon.png and logo.png")
