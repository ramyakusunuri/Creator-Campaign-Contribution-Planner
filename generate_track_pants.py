"""
Generate realistic studio photography for Fitness Track Pants (Main & Detail Angle).
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = r"C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store"
PRODUCTS_DIR = os.path.join(BASE_DIR, "assets", "images", "products")
WIDTH = 800
HEIGHT = 1060

def get_font(size, bold=False, serif=False):
    font_name = "georgiab.ttf" if (serif and bold) else ("georgia.ttf" if serif else ("calibrib.ttf" if bold else "calibri.ttf"))
    path = os.path.join(r"C:\Windows\Fonts", font_name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except:
            pass
    return ImageFont.load_default()

def create_backdrop(bg_top=(242, 244, 247), bg_bottom=(220, 224, 230), spot_pos=(400, 360), spot_radius=480):
    img = Image.new("RGB", (WIDTH, HEIGHT))
    for y in range(HEIGHT):
        ratio = y / float(HEIGHT)
        r = int(bg_top[0] * (1 - ratio) + bg_bottom[0] * ratio)
        g = int(bg_top[1] * (1 - ratio) + bg_bottom[1] * ratio)
        b = int(bg_top[2] * (1 - ratio) + bg_bottom[2] * ratio)
        for x in range(WIDTH):
            img.putpixel((x, y), (r, g, b))
            
    spot = Image.new("L", (WIDTH // 2, HEIGHT // 2), 0)
    sp_cx, sp_cy = spot_pos[0] // 2, spot_pos[1] // 2
    sp_r = spot_radius // 2
    sp_pixels = spot.load()
    for y in range(HEIGHT // 2):
        for x in range(WIDTH // 2):
            d = math.sqrt((x - sp_cx)**2 + (y - sp_cy)**2)
            if d < sp_r:
                val = int((1.0 - (d / sp_r))**1.8 * 80)
                sp_pixels[x, y] = min(255, val)
    spot = spot.resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC)
    
    white = Image.new("RGB", (WIDTH, HEIGHT), (255, 255, 255))
    img = Image.composite(white, img, spot)
    
    shadow_plane = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_plane)
    s_draw.ellipse([200, 750, 600, 840], fill=(20, 25, 35, 65))
    s_draw.ellipse([260, 765, 540, 820], fill=(15, 20, 30, 110))
    shadow_plane = shadow_plane.filter(ImageFilter.GaussianBlur(24))
    
    return Image.alpha_composite(img.convert("RGBA"), shadow_plane).convert("RGB")

def add_editorial_branding(img, title, category, spec="PERFORMANCE ATHLETIC GEAR", is_detail=False):
    draw = ImageDraw.Draw(img, "RGBA")
    
    f_brand = get_font(18, bold=True)
    f_sub = get_font(12, bold=False)
    f_tag = get_font(14, bold=True)
    f_title = get_font(22, bold=True, serif=True)
    f_spec = get_font(13, bold=False)
    
    draw.text((45, 35), "ATELIER 24 STUDIO", fill=(60, 65, 75, 230), font=f_brand)
    draw.text((45, 58), "MUMBAI • NEW DELHI", fill=(130, 135, 145, 200), font=f_sub)
    
    if is_detail:
        bw, bh = 220, 28
        bx, by = WIDTH - bw - 45, 36
        draw.rectangle([bx, by, bx + bw, by + bh], fill=(15, 20, 28, 220))
        draw.text((bx + 14, by + 6), "DETAIL & FABRIC ANGLE", fill=(255, 255, 255, 255), font=f_sub)
    else:
        draw.text((WIDTH - 180, 40), "COLLECTION 2026", fill=(130, 135, 145, 200), font=f_sub)
        
    bar_y = 930
    draw.line([(45, bar_y), (WIDTH - 45, bar_y)], fill=(210, 212, 218, 160), width=1)
    draw.text((45, bar_y + 12), category.upper(), fill=(160, 120, 70, 240), font=f_tag)
    draw.text((45, bar_y + 34), title, fill=(20, 25, 35, 250), font=f_title)
    draw.text((45, bar_y + 68), spec.upper(), fill=(120, 125, 135, 210), font=f_spec)
    return img

def render_fitness_track_pants(is_detail=False):
    img = create_backdrop(bg_top=(242, 245, 248), bg_bottom=(218, 222, 230), spot_pos=(400, 360))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Premium Athletic Matte Charcoal/Black Performance Fabric
    pant_dark = (32, 35, 42, 255)
    pant_highlight = (48, 52, 62, 255)
    seam_color = (20, 22, 27, 255)
    reflective_silver = (210, 230, 245, 255)
    
    if not is_detail:
        # Elastic Drawstring Waistband
        draw.rectangle([280, 260, 520, 310], fill=(24, 27, 33, 255))
        # Ribbed horizontal elastic lines on waistband
        for wy in range(265, 305, 8):
            draw.line([(280, wy), (520, wy)], fill=(40, 44, 52, 255), width=2)
            
        # Drawstring eyelets and hanging cords
        draw.ellipse([385, 278, 395, 288], fill=(180, 185, 195, 255), outline=(100, 105, 115, 255), width=1)
        draw.ellipse([405, 278, 415, 288], fill=(180, 185, 195, 255), outline=(100, 105, 115, 255), width=1)
        # Braided drawcords with silver aglets
        draw.line([(390, 288), (382, 345)], fill=(225, 230, 240, 255), width=3)
        draw.line([(410, 288), (418, 345)], fill=(225, 230, 240, 255), width=3)
        draw.rectangle([380, 340, 384, 350], fill=(190, 195, 205, 255))
        draw.rectangle([416, 340, 420, 350], fill=(190, 195, 205, 255))
        
        # Left Leg (Tapered Athletic Jogger Fit)
        left_pts = [(280, 310), (395, 370), (365, 740), (310, 740), (270, 420)]
        draw.polygon(left_pts, fill=pant_dark)
        
        # Right Leg
        right_pts = [(520, 310), (405, 370), (435, 740), (490, 740), (530, 420)]
        draw.polygon(right_pts, fill=pant_dark)
        
        # Thigh Fabric Highlights & Ergonomic Muscle Contours
        draw.polygon([(290, 340), (360, 370), (350, 520), (285, 480)], fill=pant_highlight)
        draw.polygon([(510, 340), (440, 370), (450, 520), (515, 480)], fill=pant_highlight)
        
        # Left Side Zipper Utility Pocket with Reflective Accent Line
        draw.line([(285, 335), (325, 415)], fill=reflective_silver, width=3)
        draw.line([(515, 335), (475, 415)], fill=reflective_silver, width=3)
        
        # Articulated Knee Seams
        draw.arc([290, 500, 355, 540], start=10, end=170, fill=seam_color, width=2)
        draw.arc([445, 500, 510, 540], start=10, end=170, fill=seam_color, width=2)
        
        # Left Thigh Reflective Logo
        draw.polygon([(320, 440), (336, 440), (328, 452)], fill=reflective_silver)
        
        # Tapered Ribbed Ankle Cuffs
        draw.rectangle([308, 740, 367, 770], fill=(18, 20, 25, 255))
        draw.rectangle([433, 740, 492, 770], fill=(18, 20, 25, 255))
        for cy in range(744, 768, 6):
            draw.line([(308, cy), (367, cy)], fill=(35, 38, 45, 255), width=2)
            draw.line([(433, cy), (492, cy)], fill=(35, 38, 45, 255), width=2)
            
    else:
        # Macro Close-up: Waistband Drawcord, Sealed Zipper Pocket & 4-Way Stretch Fabric
        draw.rectangle([100, 160, 700, 800], fill=pant_dark)
        
        # Subtle 4-way technical stretch grid weave
        for y in range(160, 800, 8):
            draw.line([(100, y), (700, y)], fill=(28, 31, 38, 255), width=1)
            
        # Heavy-Duty Ribbed Elastic Waistband Section
        draw.rectangle([100, 160, 700, 310], fill=(20, 23, 29, 255))
        for wy in range(175, 305, 14):
            draw.line([(100, wy), (700, wy)], fill=(42, 46, 56, 255), width=3)
            
        # Gunmetal Eyelet
        draw.ellipse([370, 220, 430, 280], fill=(15, 17, 21, 255), outline=(160, 165, 175, 255), width=6)
        
        # Chunky Braided Cotton Drawcord
        draw.line([(400, 250), (400, 540)], fill=(235, 240, 248, 255), width=14)
        for dy in range(260, 510, 18):
            draw.line([(393, dy), (407, dy+10)], fill=(180, 190, 205, 255), width=3)
        # Laser-Engraved Metallic Aglet Tip
        draw.rectangle([392, 510, 408, 560], fill=(195, 200, 210, 255), outline=(130, 135, 145, 255), width=2)
        
        # Sealed Waterproof Zipper Pocket with Reflective Chevron Border
        draw.polygon([(490, 360), (620, 620), (600, 630), (470, 370)], fill=(15, 18, 22, 255))
        draw.line([(490, 360), (620, 620)], fill=reflective_silver, width=6)
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 640), "4-WAY MOISTURE WICKING TECH STRETCH", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 675), "Concealed Waterproof Zip Pocket  •  Ribbed Ankle Cuffs", fill=(185, 205, 225, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Performance Athletic Track Pants", "Fitness Wear", "4-Way Tech Stretch • Zipper Utility Pockets • Tapered Fit", is_detail)

# Generate and save both images
main_img = render_fitness_track_pants(is_detail=False)
main_path = os.path.join(PRODUCTS_DIR, "fitness-track-pants.jpg")
main_img.save(main_path, quality=95)
print("Saved Main Track Pants:", main_path)

detail_img = render_fitness_track_pants(is_detail=True)
detail_path = os.path.join(PRODUCTS_DIR, "fitness-track-pants-detail.jpg")
detail_img.save(detail_path, quality=95)
print("Saved Detail Track Pants:", detail_path)
