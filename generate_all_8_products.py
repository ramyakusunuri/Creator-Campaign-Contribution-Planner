"""
Production Fashion Photography Engine for Fashion Store India
Generates 8 Distinct, High-Quality, Photo-Studio Product Images + 8 Detail Angles.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = r"C:\Users\ThisPc\.gemini\antigravity\scratch\fashion-store"
PRODUCTS_DIR = os.path.join(BASE_DIR, "assets", "images", "products")
BANNERS_DIR = os.path.join(BASE_DIR, "assets", "images", "banners")
ASSETS_DIR = os.path.join(BASE_DIR, "assets", "images")

os.makedirs(PRODUCTS_DIR, exist_ok=True)
os.makedirs(BANNERS_DIR, exist_ok=True)

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

def create_backdrop(bg_top=(248, 247, 245), bg_bottom=(230, 227, 220), spot_pos=(400, 360), spot_radius=480):
    """Generates an editorial photography studio vignette with soft overhead lighting."""
    img = Image.new("RGB", (WIDTH, HEIGHT))
    # Vertical gradient
    for y in range(HEIGHT):
        ratio = y / float(HEIGHT)
        r = int(bg_top[0] * (1 - ratio) + bg_bottom[0] * ratio)
        g = int(bg_top[1] * (1 - ratio) + bg_bottom[1] * ratio)
        b = int(bg_top[2] * (1 - ratio) + bg_bottom[2] * ratio)
        for x in range(WIDTH):
            img.putpixel((x, y), (r, g, b))
            
    # Radial spotlight overlay
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
    
    # Ground shadow plane at y=760
    shadow_plane = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_plane)
    s_draw.ellipse([200, 740, 600, 830], fill=(20, 25, 35, 65))
    s_draw.ellipse([260, 755, 540, 810], fill=(15, 20, 30, 110))
    shadow_plane = shadow_plane.filter(ImageFilter.GaussianBlur(24))
    
    img = Image.alpha_composite(img.convert("RGBA"), shadow_plane).convert("RGB")
    return img

def add_editorial_branding(img, title, category, spec="LUXURY APPAREL & GEAR", is_detail=False):
    """Draws clean high-fashion typography and watermark onto the image."""
    draw = ImageDraw.Draw(img, "RGBA")
    
    f_brand = get_font(18, bold=True)
    f_sub = get_font(12, bold=False)
    f_tag = get_font(14, bold=True)
    f_title = get_font(22, bold=True, serif=True)
    f_spec = get_font(13, bold=False)
    
    # Header Studio Watermark
    draw.text((45, 35), "ATELIER 24 STUDIO", fill=(60, 65, 75, 230), font=f_brand)
    draw.text((45, 58), "MUMBAI • NEW DELHI", fill=(130, 135, 145, 200), font=f_sub)
    
    if is_detail:
        bw, bh = 220, 28
        bx, by = WIDTH - bw - 45, 36
        draw.rectangle([bx, by, bx + bw, by + bh], fill=(15, 20, 28, 220))
        draw.text((bx + 14, by + 6), "DETAIL & FABRIC ANGLE", fill=(255, 255, 255, 255), font=f_sub)
    else:
        draw.text((WIDTH - 180, 40), "COLLECTION 2026", fill=(130, 135, 145, 200), font=f_sub)
        
    # Bottom Specification Plaque
    bar_y = 930
    draw.line([(45, bar_y), (WIDTH - 45, bar_y)], fill=(210, 212, 218, 160), width=1)
    
    draw.text((45, bar_y + 12), category.upper(), fill=(160, 120, 70, 240), font=f_tag)
    
    disp_title = title if len(title) <= 40 else title[:38] + "..."
    draw.text((45, bar_y + 34), disp_title, fill=(20, 25, 35, 250), font=f_title)
    draw.text((45, bar_y + 68), spec.upper(), fill=(120, 125, 135, 210), font=f_spec)
    
    return img

# ==========================================
# 1. SMART FITNESS BAND (Fitness Wear)
# ==========================================
def render_fitness_band(is_detail=False):
    img = create_backdrop(bg_top=(240, 242, 245), bg_bottom=(215, 220, 228), spot_pos=(400, 340))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    if not is_detail:
        # Full view: sleek curved sports band floating at angle
        # Silicone strap top loop
        draw.ellipse([260, 240, 540, 680], outline=(35, 38, 45, 255), width=48)
        # Inner depth shadow
        draw.ellipse([275, 255, 525, 665], outline=(20, 22, 26, 255), width=18)
        
        # Central OLED Tracker Module
        module_box = [340, 360, 460, 580]
        draw.rounded_rectangle(module_box, radius=32, fill=(18, 20, 25, 255), outline=(60, 65, 75, 255), width=3)
        
        # Screen Glass Bezel
        screen_box = [352, 380, 448, 560]
        draw.rounded_rectangle(screen_box, radius=22, fill=(5, 8, 12, 255))
        
        # Screen UI Elements (Cyan/Emerald metrics)
        f_time = get_font(34, bold=True)
        f_metric = get_font(13, bold=True)
        f_icon = get_font(11, bold=False)
        
        draw.text((362, 395), "10:45", fill=(255, 255, 255, 255), font=f_time)
        draw.text((365, 438), "AM  •  MON", fill=(0, 230, 255, 240), font=f_icon)
        
        # Pulse wave line (cyan)
        pts = [(362, 475), (378, 475), (388, 462), (398, 490), (408, 468), (418, 475), (438, 475)]
        draw.line(pts, fill=(0, 255, 170, 255), width=3)
        draw.text((365, 498), "♥ 74 BPM", fill=(255, 75, 110, 255), font=f_metric)
        draw.text((365, 522), "👟 8,420", fill=(0, 230, 255, 255), font=f_metric)
        
        # Silicone Strap texture & perforations
        for y in range(280, 350, 16):
            draw.ellipse([385, y, 415, y+8], fill=(25, 28, 34, 255))
        for y in range(590, 660, 16):
            draw.ellipse([385, y, 415, y+8], fill=(25, 28, 34, 255))
            
    else:
        # Macro detail shot of OLED Screen & Beveled Glass
        draw.rounded_rectangle([180, 180, 620, 780], radius=50, fill=(15, 17, 22, 255), outline=(75, 80, 95, 255), width=6)
        draw.rounded_rectangle([205, 210, 595, 750], radius=38, fill=(4, 6, 10, 255))
        
        f_big = get_font(72, bold=True)
        f_sub_ui = get_font(24, bold=True)
        f_detail = get_font(18, bold=False)
        
        draw.text((250, 260), "10:45", fill=(255, 255, 255, 255), font=f_big)
        draw.text((252, 345), "MON, 18 OCT  |  BATTERY 92%", fill=(0, 225, 255, 230), font=f_detail)
        
        # Dynamic Heart Rate ECG Graph
        ecg_pts = [(240, 440), (280, 440), (310, 400), (330, 480), (350, 380), (370, 450), (410, 440), (560, 440)]
        draw.line(ecg_pts, fill=(0, 255, 170, 255), width=6)
        
        draw.text((250, 470), "♥ 74 BPM  •  OPTIMAL ZONE", fill=(255, 60, 100, 255), font=f_sub_ui)
        draw.text((250, 520), "⚡ 642 KCAL BURNED", fill=(255, 190, 40, 255), font=f_sub_ui)
        draw.text((250, 570), "👟 8,420 / 10,000 STEPS", fill=(0, 230, 255, 255), font=f_sub_ui)
        draw.text((250, 620), "💧 5ATM WATER RESISTANT", fill=(160, 170, 190, 230), font=f_detail)
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Smart Fitness Band", "Fitness Wear", "AMOLED 1.62\" Display • 24/7 Heart & SpO2 Monitor", is_detail)

# ==========================================
# 2. PERFORMANCE SPORTS T-SHIRT (Fitness Wear)
# ==========================================
def render_sports_tshirt(is_detail=False):
    img = create_backdrop(bg_top=(242, 245, 248), bg_bottom=(220, 226, 235), spot_pos=(400, 360))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    if not is_detail:
        # Athletic Blue Cobalt technical tee
        body_color = (25, 55, 120, 255)
        accent_color = (15, 35, 85, 255)
        mesh_color = (18, 42, 98, 255)
        
        # Torso
        torso_pts = [(240, 340), (560, 340), (540, 720), (260, 720)]
        draw.polygon(torso_pts, fill=body_color)
        
        # Ergonomic Side Breathable Mesh Panels
        draw.polygon([(240, 370), (280, 370), (300, 720), (260, 720)], fill=mesh_color)
        draw.polygon([(560, 370), (520, 370), (500, 720), (540, 720)], fill=mesh_color)
        
        # Sleeves (Raglan Cut)
        draw.polygon([(240, 340), (130, 450), (190, 500), (260, 420)], fill=body_color)
        draw.polygon([(560, 340), (670, 450), (610, 500), (540, 420)], fill=body_color)
        
        # Athletic Raglan Seams
        draw.line([(340, 280), (260, 420)], fill=(0, 210, 255, 200), width=3)
        draw.line([(460, 280), (540, 420)], fill=(0, 210, 255, 200), width=3)
        
        # Crew Neck Collar
        draw.polygon([(330, 280), (470, 280), (450, 340), (350, 340)], fill=accent_color)
        draw.arc([340, 290, 460, 350], start=0, end=180, fill=(0, 220, 255, 240), width=3)
        
        # Chest Reflective Logo & Tech Wordmark
        draw.polygon([(380, 420), (420, 420), (400, 445)], fill=(230, 245, 255, 255))
        f_tech = get_font(12, bold=True)
        draw.text((362, 455), "AEROMESH", fill=(180, 220, 255, 220), font=f_tech)
        
        # Bottom curve hem
        draw.arc([260, 690, 540, 735], start=0, end=180, fill=(15, 35, 80, 255), width=6)
        
    else:
        # Extreme close-up of perforated moisture-wicking technical fabric & silver logo
        draw.rectangle([100, 160, 700, 800], fill=(22, 50, 115, 255))
        
        # Micro-perforated mesh pattern
        for y in range(180, 780, 14):
            for x in range(120, 680, 14):
                draw.ellipse([x, y, x+3, y+3], fill=(12, 32, 80, 255))
                
        # Reflective high-definition metallic chest emblem
        draw.polygon([(350, 360), (450, 360), (400, 420)], fill=(240, 248, 255, 255), outline=(180, 220, 255, 255), width=4)
        
        # Laser-cut bonded seamless tape
        draw.line([(200, 520), (600, 520)], fill=(0, 225, 255, 220), width=6)
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 545), "HYPER-VENTILATION MESH ZONES", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 580), "Anti-Odor Polygiene®  •  4-Way Engineered Stretch", fill=(170, 215, 255, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Performance Sports T-Shirt", "Fitness Wear", "Quick-Dry Moisture Wicking • Raglan Ergonomic Fit", is_detail)

# ==========================================
# 3. CLASSIC CASUAL T-SHIRT (Casual Wear)
# ==========================================
def render_casual_tshirt(is_detail=False):
    img = create_backdrop(bg_top=(247, 245, 242), bg_bottom=(228, 225, 218), spot_pos=(400, 360))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Soft Olive Sage / Chalk White natural organic cotton
    body_color = (138, 154, 132, 255)
    shadow_color = (112, 128, 108, 255)
    collar_color = (122, 138, 116, 255)
    
    if not is_detail:
        # Full view relaxed casual crewneck tee
        draw.polygon([(250, 340), (550, 340), (535, 730), (265, 730)], fill=body_color)
        
        # Sleeves with neat folded cuffs
        draw.polygon([(250, 340), (145, 435), (195, 490), (270, 420)], fill=body_color)
        draw.polygon([(550, 340), (655, 435), (605, 490), (530, 420)], fill=body_color)
        # Folded cuff lines
        draw.line([(155, 445), (205, 500)], fill=shadow_color, width=4)
        draw.line([(645, 445), (595, 500)], fill=shadow_color, width=4)
        
        # Ribbed Crewneck Collar
        draw.arc([335, 275, 465, 350], start=0, end=180, fill=collar_color, width=16)
        draw.arc([342, 282, 458, 342], start=0, end=180, fill=(85, 98, 80, 255), width=2)
        
        # Natural drape creases
        draw.line([(290, 440), (330, 520)], fill=shadow_color, width=3)
        draw.line([(510, 450), (470, 540)], fill=shadow_color, width=3)
        draw.line([(310, 620), (360, 680)], fill=shadow_color, width=2)
        
        # Twin needle bottom hem
        draw.line([(265, 715), (535, 715)], fill=shadow_color, width=2)
        draw.line([(265, 720), (535, 720)], fill=shadow_color, width=2)
        
    else:
        # Detail view: Ribbed crewneck and organic combed cotton texture
        draw.rectangle([100, 160, 700, 800], fill=body_color)
        
        # Ribbed collar close-up
        draw.arc([150, 100, 650, 420], start=0, end=180, fill=collar_color, width=40)
        # Ribbed vertical lines on collar
        for deg in range(15, 165, 4):
            rad = math.radians(deg)
            cx, cy = 400, 260
            x1 = cx - math.cos(rad) * 230
            y1 = cy + math.sin(rad) * 110
            x2 = cx - math.cos(rad) * 270
            y2 = cy + math.sin(rad) * 150
            draw.line([(x1, y1), (x2, y2)], fill=(95, 110, 90, 255), width=2)
            
        # Subtle combed cotton weave texture
        for y in range(400, 780, 8):
            draw.line([(120, y), (680, y)], fill=(130, 145, 124, 255), width=1)
            
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 560), "100% COMBED COMPACT COTTON (220 GSM)", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 595), "Pre-Shrunk Bio-Wash  •  Reinforced Shoulder Taping", fill=(225, 235, 220, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Classic Casual T-Shirt", "Casual Wear", "100% Combed Compact Cotton • Bio-Washed 220 GSM", is_detail)

# ==========================================
# 4. CASUAL DENIM JEANS (Casual Wear)
# ==========================================
def render_denim_jeans(is_detail=False):
    img = create_backdrop(bg_top=(245, 244, 240), bg_bottom=(224, 222, 215), spot_pos=(400, 380))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Authentic Indigo Medium Wash
    denim_dark = (32, 58, 96, 255)
    denim_fade = (54, 88, 138, 255)
    gold_stitch = (215, 160, 45, 255)
    copper_rivet = (185, 105, 50, 255)
    
    if not is_detail:
        # Waistband
        draw.rectangle([270, 280, 530, 320], fill=denim_dark)
        draw.line([(270, 283), (530, 283)], fill=gold_stitch, width=2)
        draw.line([(270, 317), (530, 317)], fill=gold_stitch, width=2)
        # Metal Waist Button
        draw.ellipse([390, 292, 410, 312], fill=(180, 185, 195, 255), outline=(90, 95, 105, 255), width=2)
        
        # Left and Right Legs
        # Left leg
        draw.polygon([(270, 320), (395, 370), (370, 770), (250, 770)], fill=denim_dark)
        # Right leg
        draw.polygon([(530, 320), (405, 370), (430, 770), (550, 770)], fill=denim_dark)
        
        # Thigh Whiskering & Fades
        draw.ellipse([275, 410, 355, 530], fill=denim_fade)
        draw.ellipse([445, 410, 525, 530], fill=denim_fade)
        
        # Fly seam and crotch
        draw.line([(400, 320), (400, 370)], fill=gold_stitch, width=2)
        draw.arc([385, 320, 415, 390], start=0, end=90, fill=gold_stitch, width=2)
        
        # Curved Front Pockets with Rivets
        draw.arc([270, 320, 340, 380], start=270, end=360, fill=gold_stitch, width=2)
        draw.arc([460, 320, 530, 380], start=180, end=270, fill=gold_stitch, width=2)
        draw.ellipse([335, 335, 343, 343], fill=copper_rivet)
        draw.ellipse([457, 335, 465, 343], fill=copper_rivet)
        
        # Contrast Inseam & Outseam Stitching
        draw.line([(252, 770), (272, 320)], fill=gold_stitch, width=2)
        draw.line([(548, 770), (528, 320)], fill=gold_stitch, width=2)
        
        # Rolled Hem at base
        draw.rectangle([248, 755, 372, 770], fill=(70, 100, 150, 255))
        draw.rectangle([428, 755, 552, 770], fill=(70, 100, 150, 255))
        
    else:
        # Macro detail shot of Front Coin Pocket, Copper Rivet, and Denim Twill
        draw.rectangle([100, 160, 700, 800], fill=denim_dark)
        
        # Twill weave lines (diagonal denim grain)
        for d in range(-600, 1200, 8):
            draw.line([(100, d), (700, d + 600)], fill=(25, 48, 82, 255), width=1)
            
        # Curved Pocket Edge
        draw.arc([100, 120, 580, 540], start=0, end=90, fill=gold_stitch, width=5)
        draw.arc([100, 130, 570, 530], start=0, end=90, fill=gold_stitch, width=3)
        
        # Coin Pocket
        draw.rectangle([340, 280, 500, 420], outline=gold_stitch, width=4)
        
        # Embossed Copper Rivet close-up
        draw.ellipse([485, 270, 525, 310], fill=copper_rivet, outline=(90, 45, 15, 255), width=3)
        draw.ellipse([495, 280, 515, 300], fill=(220, 140, 75, 255))
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 600), "PREMIUM RING-SPUN 12.5 OZ DENIM", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 635), "100% Brass Hardware  •  Authentic Indigo Wash", fill=(210, 225, 245, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Casual Denim Jeans", "Casual Wear", "Mid-Rise Straight Fit • Authentic Medium Indigo Wash", is_detail)

# ==========================================
# 5. COMFORTABLE COTTON NIGHT SUIT (Night Wear)
# ==========================================
def render_cotton_night_suit(is_detail=False):
    img = create_backdrop(bg_top=(248, 246, 244), bg_bottom=(232, 228, 222), spot_pos=(400, 360))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Soft Powder Sky Blue Cotton Pajama Set with White Piping
    fabric_blue = (175, 198, 215, 255)
    shadow_blue = (145, 170, 190, 255)
    piping_white = (255, 255, 255, 255)
    
    if not is_detail:
        # Shirt Torso
        draw.polygon([(260, 280), (540, 280), (525, 540), (275, 540)], fill=fabric_blue)
        
        # Sleeves
        draw.polygon([(260, 280), (170, 380), (210, 430), (280, 360)], fill=fabric_blue)
        draw.polygon([(540, 280), (630, 380), (590, 430), (520, 360)], fill=fabric_blue)
        # Sleeve white piping cuffs
        draw.line([(170, 380), (210, 430)], fill=piping_white, width=4)
        draw.line([(630, 380), (590, 430)], fill=piping_white, width=4)
        
        # Classic Notch Lapel Pajama Collar
        draw.polygon([(340, 280), (400, 360), (330, 350)], fill=fabric_blue, outline=piping_white, width=3)
        draw.polygon([(460, 280), (400, 360), (470, 350)], fill=fabric_blue, outline=piping_white, width=3)
        
        # Front button placket with white buttons
        draw.line([(400, 360), (400, 540)], fill=piping_white, width=2)
        for by in (390, 430, 470, 510):
            draw.ellipse([395, by, 405, by+10], fill=piping_white, outline=shadow_blue, width=1)
            
        # Left Chest Pocket with white piping rim
        draw.rectangle([435, 400, 485, 450], fill=fabric_blue, outline=shadow_blue, width=1)
        draw.line([(435, 400), (485, 400)], fill=piping_white, width=3)
        
        # Pajama Trousers
        draw.polygon([(285, 550), (515, 550), (485, 780), (410, 780), (400, 620), (390, 780), (315, 780)], fill=fabric_blue)
        # White piping trouser cuffs
        draw.line([(315, 775), (390, 775)], fill=piping_white, width=4)
        draw.line([(410, 775), (485, 775)], fill=piping_white, width=4)
        
    else:
        # Detail view: Notch Lapel with contrast white piping & Mother-of-Pearl Button
        draw.rectangle([100, 160, 700, 800], fill=fabric_blue)
        
        # Soft breathable cotton horizontal weave
        for y in range(160, 800, 10):
            draw.line([(100, y), (700, y)], fill=(165, 190, 208, 255), width=1)
            
        # Notch Collar Shape with sharp white piping
        draw.polygon([(250, 160), (460, 460), (280, 420)], fill=fabric_blue)
        draw.line([(250, 160), (460, 460)], fill=piping_white, width=8)
        draw.line([(460, 460), (280, 420)], fill=piping_white, width=8)
        
        # Button Placket
        draw.line([(460, 460), (460, 800)], fill=piping_white, width=6)
        
        # Mother of Pearl Button
        draw.ellipse([435, 520, 485, 570], fill=(250, 250, 252, 255), outline=(130, 155, 175, 255), width=3)
        draw.ellipse([450, 535, 456, 541], fill=(130, 155, 175, 255))
        draw.ellipse([464, 535, 470, 541], fill=(130, 155, 175, 255))
        draw.ellipse([450, 549, 456, 555], fill=(130, 155, 175, 255))
        draw.ellipse([464, 549, 470, 555], fill=(130, 155, 175, 255))
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 640), "100% PURE BREATHABLE COMBED COTTON", fill=(45, 65, 85, 240), font=f_spec_macro)
        draw.text((210, 675), "Contrast Satin Piping  •  Mother-of-Pearl Buttons", fill=(75, 95, 115, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Comfortable Cotton Night Suit", "Night Wear", "2-Piece Relaxed Pajama Set • 100% Breathable Cotton", is_detail)

# ==========================================
# 6. SATIN NIGHT DRESS (Night Wear)
# ==========================================
def render_satin_dress(is_detail=False):
    img = create_backdrop(bg_top=(246, 242, 244), bg_bottom=(226, 218, 222), spot_pos=(400, 350))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Lustrous Champagne Blush Rose Liquid Satin
    satin_base = (205, 155, 165, 255)
    satin_highlight = (242, 215, 222, 255)
    satin_shadow = (165, 115, 128, 255)
    lace_color = (255, 240, 245, 240)
    
    if not is_detail:
        # Spaghetti Straps
        draw.line([(355, 240), (370, 310)], fill=satin_base, width=3)
        draw.line([(445, 240), (430, 310)], fill=satin_base, width=3)
        
        # V-Neck Bodice with scalloped lace trim
        draw.polygon([(340, 310), (460, 310), (400, 380)], fill=satin_base)
        draw.line([(340, 310), (400, 380)], fill=lace_color, width=6)
        draw.line([(460, 310), (400, 380)], fill=lace_color, width=6)
        
        # Fluid Flared Silhouette
        skirt_pts = [(340, 310), (460, 310), (510, 520), (560, 760), (240, 760), (290, 520)]
        draw.polygon(skirt_pts, fill=satin_base)
        
        # Liquid satin vertical sheen reflections
        draw.polygon([(370, 380), (410, 380), (430, 760), (390, 760)], fill=satin_highlight)
        draw.polygon([(460, 420), (490, 420), (520, 760), (490, 760)], fill=satin_shadow)
        
        # Scalloped lace hem
        draw.arc([240, 745, 560, 775], start=0, end=180, fill=lace_color, width=8)
        
    else:
        # Macro close-up of V-neckline floral lace and liquid satin sheen
        draw.rectangle([100, 160, 700, 800], fill=satin_base)
        
        # Flowing gradient sheen reflection
        draw.polygon([(260, 160), (480, 160), (550, 800), (330, 800)], fill=satin_highlight)
        
        # Scalloped Floral Lace Border along neckline
        draw.line([(150, 200), (400, 520)], fill=lace_color, width=14)
        draw.line([(650, 200), (400, 520)], fill=lace_color, width=14)
        # Lace scallops
        for t in range(0, 10):
            lx = 150 + t * 25
            ly = 200 + t * 32
            draw.ellipse([lx-10, ly-10, lx+10, ly+10], fill=lace_color)
            rx = 650 - t * 25
            ry = 200 + t * 32
            draw.ellipse([rx-10, ry-10, rx+10, ry+10], fill=lace_color)
            
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 600), "PREMIUM HIGH-LUSTRE LIQUID SATIN", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 635), "French Eyelash Lace Trim  •  Adjustable Straps", fill=(245, 225, 230, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Satin Night Dress", "Night Wear", "Lustrous Liquid Satin • French Scalloped Lace Trim", is_detail)

# ==========================================
# 7. ELEGANT PARTY DRESS (Party Wear)
# ==========================================
def render_party_dress(is_detail=False):
    img = create_backdrop(bg_top=(240, 238, 242), bg_bottom=(218, 212, 222), spot_pos=(400, 340))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Deep Emerald Jewel Velvet / Shimmer Lurex
    dress_color = (20, 62, 52, 255)
    shimmer_color = (45, 115, 95, 255)
    gold_accent = (212, 175, 55, 255)
    
    if not is_detail:
        # Asymmetrical one-shoulder couture drape
        draw.polygon([(340, 260), (410, 260), (440, 340), (330, 340)], fill=dress_color)
        
        # Contoured Hourglass Bodice
        draw.polygon([(330, 340), (470, 340), (450, 490), (350, 490)], fill=dress_color)
        
        # Shimmering Lurex Highlight along side contour
        draw.polygon([(420, 340), (470, 340), (450, 490), (400, 490)], fill=shimmer_color)
        
        # Flared Midi Evening Skirt with side slit
        skirt_pts = [(350, 490), (450, 490), (510, 770), (290, 770)]
        draw.polygon(skirt_pts, fill=dress_color)
        
        # High side split line with gold piping
        draw.line([(450, 490), (480, 660)], fill=gold_accent, width=2)
        
        # Dramatic draping folds
        draw.line([(360, 520), (440, 620)], fill=(12, 42, 35, 255), width=4)
        draw.line([(340, 610), (420, 710)], fill=(12, 42, 35, 255), width=4)
        
    else:
        # Macro detail shot of Shimmering Lurex weave & asymmetric neckline
        draw.rectangle([100, 160, 700, 800], fill=dress_color)
        
        # Shimmer sparkle particles
        for _ in range(350):
            sx = random.randint(120, 680)
            sy = random.randint(180, 780)
            draw.point((sx, sy), fill=(random.randint(180, 255), random.randint(220, 255), random.randint(200, 255), 220))
            
        # Asymmetrical folded neckline drape
        draw.polygon([(150, 220), (650, 380), (620, 480), (120, 320)], fill=shimmer_color, outline=gold_accent, width=3)
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 600), "METALLIC LUREX SHIMMER WEAVE", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 635), "Asymmetrical Sculpted Draping  •  Evening Midi Cut", fill=(190, 235, 220, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Elegant Party Dress", "Party Wear", "Sculpted Hourglass Silhouette • Metallic Lurex Shimmer", is_detail)

# ==========================================
# 8. PARTY WEAR SHIRT (Party Wear)
# ==========================================
def render_party_shirt(is_detail=False):
    img = create_backdrop(bg_top=(244, 242, 240), bg_bottom=(222, 218, 214), spot_pos=(400, 350))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    
    # Deep Rich Wine Burgundy Sateen with High Luster
    wine_base = (78, 16, 32, 255)
    wine_highlight = (120, 30, 52, 255)
    wine_shadow = (48, 8, 18, 255)
    obsidian_btn = (15, 15, 18, 255)
    
    if not is_detail:
        # Shirt Body
        draw.polygon([(250, 320), (550, 320), (530, 720), (270, 720)], fill=wine_base)
        
        # Sleeves with structured shoulders
        draw.polygon([(250, 320), (150, 420), (195, 470), (270, 400)], fill=wine_base)
        draw.polygon([(550, 320), (650, 420), (605, 470), (530, 400)], fill=wine_base)
        
        # High-luster central light beam
        draw.polygon([(360, 320), (440, 320), (430, 720), (370, 720)], fill=wine_highlight)
        
        # Spread Cutaway Party Collar
        draw.polygon([(330, 260), (400, 340), (290, 330)], fill=wine_shadow, outline=(150, 40, 65, 255), width=2)
        draw.polygon([(470, 260), (400, 340), (510, 330)], fill=wine_shadow, outline=(150, 40, 65, 255), width=2)
        
        # French placket with high-gloss obsidian buttons
        draw.line([(400, 340), (400, 720)], fill=(35, 5, 12, 255), width=3)
        for by in (380, 440, 500, 560, 620, 680):
            draw.ellipse([394, by, 406, by+12], fill=obsidian_btn, outline=(180, 180, 190, 255), width=1)
            
    else:
        # Macro detail shot of Spread Collar, Obsidian Button, and Lustrous Sateen
        draw.rectangle([100, 160, 700, 800], fill=wine_base)
        
        # Sateen weave sheen
        for y in range(160, 800, 12):
            draw.line([(100, y), (700, y)], fill=(90, 20, 40, 255), width=1)
            
        # Cutaway Spread Collar Point
        draw.polygon([(220, 160), (450, 480), (260, 450)], fill=wine_shadow, outline=(160, 45, 70, 255), width=4)
        
        # Button Placket
        draw.line([(450, 480), (450, 800)], fill=(35, 5, 12, 255), width=6)
        
        # High-Gloss Obsidian Pearl Button with Cross Stitching
        draw.ellipse([420, 560, 480, 620], fill=obsidian_btn, outline=(220, 220, 230, 255), width=3)
        draw.line([(440, 580), (460, 600)], fill=(200, 200, 200, 255), width=2)
        draw.line([(440, 600), (460, 580)], fill=(200, 200, 200, 255), width=2)
        
        f_spec_macro = get_font(20, bold=True)
        draw.text((210, 680), "HIGH-LUSTRE LIQUID COTTON SATEEN", fill=(255, 255, 255, 240), font=f_spec_macro)
        draw.text((210, 715), "Cutaway Spread Collar  •  Gloss Obsidian Buttons", fill=(235, 195, 205, 220), font=get_font(16))
        
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return add_editorial_branding(img, "Party Wear Shirt", "Party Wear", "Lustrous Cotton Sateen • Cutaway Spread Collar", is_detail)

# ==========================================
# 9. BANNERS & FALLBACK IMAGE
# ==========================================
def render_banners():
    # Hero Festive Banner (1600 x 800)
    hero = Image.new("RGB", (1600, 800), (12, 16, 24))
    h_draw = ImageDraw.Draw(hero)
    
    # Gradient overlay
    for y in range(800):
        ratio = y / 800.0
        r = int(12 * (1 - ratio) + 24 * ratio)
        g = int(22 * (1 - ratio) + 40 * ratio)
        b = int(32 * (1 - ratio) + 56 * ratio)
        for x in range(1600):
            hero.putpixel((x, y), (r, g, b))
            
    # Gold bokeh particles
    for _ in range(120):
        bx = random.randint(0, 1600)
        by = random.randint(0, 800)
        br = random.randint(6, 40)
        h_draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(212, 175, 55, random.randint(15, 60)))
        
    hero_path = os.path.join(BANNERS_DIR, "hero-festive-capsule.jpg")
    hero.save(hero_path, quality=95)
    print("Saved:", hero_path)
    
    # Ethnic banner (1200 x 500)
    ethnic = Image.new("RGB", (1200, 500), (45, 15, 22))
    e_draw = ImageDraw.Draw(ethnic)
    for _ in range(80):
        bx = random.randint(0, 1200)
        by = random.randint(0, 500)
        br = random.randint(8, 30)
        e_draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(212, 175, 55, random.randint(20, 80)))
    ethnic_path = os.path.join(BANNERS_DIR, "ethnic-banner.jpg")
    ethnic.save(ethnic_path, quality=95)
    print("Saved:", ethnic_path)
    
    # Universal Fallback Image
    fallback = create_backdrop(bg_top=(245, 243, 239), bg_bottom=(225, 221, 215))
    fallback = add_editorial_branding(fallback, "Contemporary Luxury Fashion", "Atelier 24 India", "Handcrafted in Mumbai & New Delhi")
    fb_path = os.path.join(ASSETS_DIR, "fallback.jpg")
    fallback.save(fb_path, quality=95)
    print("Saved:", fb_path)

def generate_all():
    print("Beginning generation of all 8 product images...")
    
    specs = [
        ("smart-fitness-band.jpg", "smart-fitness-band-detail.jpg", render_fitness_band),
        ("performance-sports-tshirt.jpg", "performance-sports-tshirt-detail.jpg", render_sports_tshirt),
        ("classic-casual-tshirt.jpg", "classic-casual-tshirt-detail.jpg", render_casual_tshirt),
        ("casual-denim-jeans.jpg", "casual-denim-jeans-detail.jpg", render_denim_jeans),
        ("cotton-night-suit.jpg", "cotton-night-suit-detail.jpg", render_cotton_night_suit),
        ("satin-night-dress.jpg", "satin-night-dress-detail.jpg", render_satin_dress),
        ("elegant-party-dress.jpg", "elegant-party-dress-detail.jpg", render_party_dress),
        ("party-wear-shirt.jpg", "party-wear-shirt-detail.jpg", render_party_shirt)
    ]
    
    for main_name, detail_name, func in specs:
        main_img = func(is_detail=False)
        main_path = os.path.join(PRODUCTS_DIR, main_name)
        main_img.save(main_path, quality=95)
        print("Generated Main:", main_path)
        
        detail_img = func(is_detail=True)
        detail_path = os.path.join(PRODUCTS_DIR, detail_name)
        detail_img.save(detail_path, quality=95)
        print("Generated Detail:", detail_path)
        
    render_banners()
    print("ALL 16 PRODUCT IMAGES + BANNERS GENERATED SUCCESSFULLY!")

if __name__ == "__main__":
    generate_all()
