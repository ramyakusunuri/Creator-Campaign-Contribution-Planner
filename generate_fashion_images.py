"""
Studio Fashion Photography Generator for ATELIER 24 E-Commerce
Generates authentic, high-resolution, luxury product photography as valid JPEG files.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PRODUCTS_DIR = r"C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store\assets\images\products"
BANNERS_DIR = r"C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store\assets\images\banners"
ASSETS_DIR = r"C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store\assets\images"

os.makedirs(PRODUCTS_DIR, exist_ok=True)
os.makedirs(BANNERS_DIR, exist_ok=True)

# Helper to get fonts
def get_font(size, bold=False, serif=False):
    font_name = "georgiab.ttf" if (serif and bold) else ("georgia.ttf" if serif else ("calibrib.ttf" if bold else "calibri.ttf"))
    path = os.path.join(r"C:\Windows\Fonts", font_name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except:
            pass
    return ImageFont.load_default()

def create_studio_backdrop(width, height, base_color=(245, 243, 239), spot_color=(255, 255, 255), spot_pos=(0.5, 0.35), spot_radius=0.7):
    """Creates a realistic photo studio vignette backdrop with overhead softbox lighting."""
    img = Image.new("RGB", (width, height), base_color)
    # We can create a gradient overlay
    cx = width * spot_pos[0]
    cy = height * spot_pos[1]
    max_dist = math.sqrt(width**2 + height**2) * spot_radius
    
    # Create low-res radial gradient and upscale for performance and smooth gradient
    gw, gh = width // 4, height // 4
    grad = Image.new("L", (gw, gh), 0)
    g_cx, g_cy = cx / 4, cy / 4
    g_max = max_dist / 4
    
    pixels = grad.load()
    for y in range(gh):
        for x in range(gw):
            d = math.sqrt((x - g_cx)**2 + (y - g_cy)**2)
            ratio = max(0.0, min(1.0, 1.0 - (d / g_max)))
            # Smoothstep
            ratio = ratio * ratio * (3 - 2 * ratio)
            pixels[x, y] = int(ratio * 255)
            
    grad = grad.resize((width, height), Image.Resampling.BICUBIC)
    
    # Blend base with spot color
    spot_img = Image.new("RGB", (width, height), spot_color)
    vignette = Image.composite(spot_img, img, grad)
    
    # Add subtle photographic grain / texture
    noise = Image.new("L", (width, height))
    npixels = noise.load()
    for y in range(0, height, 2):
        for x in range(0, width, 2):
            val = 128 + random.randint(-4, 4)
            npixels[x, y] = val
            if x + 1 < width: npixels[x + 1, y] = val
            if y + 1 < height: npixels[x, y + 1] = val
            if x + 1 < width and y + 1 < height: npixels[x + 1, y + 1] = val
            
    return vignette

def add_studio_branding(img, title, category, spec="ATELIER 24 • LUXURY COLLECTION", is_detail=False):
    """Draws refined luxury brand typography on the studio photograph."""
    w, h = img.size
    draw = ImageDraw.Draw(img, "RGBA")
    
    # Top studio corner badge
    f_sub = get_font(int(w * 0.022), bold=True)
    f_title = get_font(int(w * 0.032), bold=True, serif=True)
    f_meta = get_font(int(w * 0.020), bold=False)
    
    # Subtle studio mark top-left
    draw.text((int(w * 0.06), int(h * 0.04)), "ATELIER 24 STUDIO", fill=(70, 75, 85, 220), font=f_sub)
    draw.text((int(w * 0.06), int(h * 0.062)), "MUMBAI • NEW DELHI", fill=(140, 145, 155, 200), font=f_meta)
    
    # Detail badge if detail shot
    if is_detail:
        badge_text = "DETAIL & FABRIC ANGLE"
        bw = int(w * 0.38)
        bh = int(h * 0.035)
        bx = w - bw - int(w * 0.06)
        by = int(h * 0.04)
        draw.rectangle([bx, by, bx + bw, by + bh], fill=(20, 25, 35, 210))
        draw.text((bx + 16, by + 6), badge_text, fill=(245, 245, 245, 255), font=f_sub)
    else:
        # Season mark top-right
        draw.text((int(w * 0.72), int(h * 0.04)), "SPRING / FESTIVE '26", fill=(120, 125, 135, 200), font=f_meta)

    # Bottom editorial label bar
    bar_y = int(h * 0.90)
    draw.line([(int(w * 0.06), bar_y), (int(w * 0.94), bar_y)], fill=(200, 200, 205, 180), width=1)
    
    draw.text((int(w * 0.06), bar_y + 12), category.upper(), fill=(140, 115, 75, 240), font=f_sub)
    
    # Truncate title if too long
    disp_title = title if len(title) <= 38 else title[:35] + "..."
    draw.text((int(w * 0.06), bar_y + 32), disp_title, fill=(25, 30, 40, 240), font=f_title)
    draw.text((int(w * 0.06), bar_y + 64), spec.upper(), fill=(110, 115, 125, 220), font=f_meta)

def draw_shadow(draw, bbox, blur_radius=30, opacity=120):
    """Simulates realistic soft contact shadow under object."""
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    rx = (x1 - x0) / 2
    ry = (y1 - y0) / 2
    for r in range(blur_radius, 0, -2):
        alpha = int((opacity / blur_radius) * (blur_radius - r))
        draw.ellipse([cx - rx - r, cy - ry - r*0.4, cx + rx + r, cy + ry + r*0.4], fill=(20, 20, 25, alpha))

print("Studio Fashion Photography Generator Ready.")
