"""
Script to generate photorealistic product photography for the 8 fashion products.
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

# Test font loading
def get_font(size, bold=False, serif=False):
    font_name = "georgiab.ttf" if (serif and bold) else ("georgia.ttf" if serif else ("calibrib.ttf" if bold else "calibri.ttf"))
    path = os.path.join(r"C:\Windows\Fonts", font_name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except:
            pass
    return ImageFont.load_default()

print("Font loaded successfully.")
