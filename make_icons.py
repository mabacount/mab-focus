import os
import struct
import zlib

def make_png(width, height, r, g, b):
    # ساخت فایل معتبر PNG بدون وابستگی خارجی
    png_sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # پیکسل‌ها: دایره آبی کبالت در مرکز
    raw = bytearray()
    cx, cy = width / 2, height / 2
    for y in range(height):
        raw.append(0)  # filter type 0
        for x in range(width):
            dist = ((x - cx)**2 + (y - cy)**2)**0.5
            if dist < width * 0.42:
                raw.extend([r, g, b])         # آبی Mab-Focus
            else:
                raw.extend([20, 20, 22])       # پس‌زمینه ابسیدین
                
    comp = zlib.compress(bytes(raw))
    idat_crc = zlib.crc32(b'IDAT' + comp)
    idat = struct.pack('>I', len(comp)) + b'IDAT' + comp + struct.pack('>I', idat_crc)
    
    # IEND
    iend_crc = zlib.crc32(b'IEND')
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png_sig + ihdr + idat + iend

def make_ico(png_data, size):
    # جاسازی مستقیم PNG درون ساختار استاندارد مایکروسافت ICO
    header = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII', size, size, 0, 0, 1, 32, len(png_data), 22)
    return header + entry + png_data

def generate_all():
    icons_dir = os.path.join("src-tauri", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    
    # تولید رزولوشن‌های مختلف
    png_32 = make_png(32, 32, 59, 130, 246)
    png_128 = make_png(128, 128, 59, 130, 246)
    png_256 = make_png(256, 256, 59, 130, 246)
    ico_data = make_ico(png_32, 32)
    
    files = {
        "32x32.png": png_32,
        "128x128.png": png_128,
        "128x128@2x.png": png_256,
        "icon.ico": ico_data,
        "icon.icns": png_256 # کپی سبک برای سازگاری باندلر
    }
    
    for filename, data in files.items():
        filepath = os.path.join(icons_dir, filename)
        with open(filepath, "wb") as f:
            f.write(data)
        print(f"✓ فایل آیکون ساخته شد: {filepath}")
        
    print("\n✅ تمام آیکون‌های استاندارد با موفقیت ایجاد شدند.")

if __name__ == "__main__":
    generate_all()