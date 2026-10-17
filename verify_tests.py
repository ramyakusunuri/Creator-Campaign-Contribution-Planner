import urllib.request
import re
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

# 1. Check index.html serves 200
html_resp = urllib.request.urlopen('http://localhost:3000/index.html')
assert html_resp.status == 200
html_content = html_resp.read().decode('utf-8')
print('PASS 1: index.html served with HTTP 200')

# 2. Check products.js serves 200
js_resp = urllib.request.urlopen('http://localhost:3000/products.js')
assert js_resp.status == 200
js_content = js_resp.read().decode('utf-8')
print('PASS 2: products.js served with HTTP 200')

# 3. Extract products
titles = re.findall(r'title:\s*"([^"]+)"', js_content)
prices = re.findall(r'price:\s*(\d+)', js_content)
orig_prices = re.findall(r'origPrice:\s*(\d+)', js_content)
categories = re.findall(r'category:\s*"([^"]+)"', js_content)
images = re.findall(r'image:\s*"([^"]+)"', js_content)

print(f'Total products in catalog: {len(titles)}')
assert len(titles) == 8, f'Expected 8 products, found {len(titles)}'
print('PASS 3: Exactly 8 products present in catalog')

# 4. Check category distribution
cat_counts = Counter(categories)
print('Category distribution:', dict(cat_counts))
assert len(cat_counts) == 4, 'Expected 4 categories'
for cat, count in cat_counts.items():
    assert count == 2, f'Category {cat} has {count} products instead of 2'
print('PASS 4: All 4 categories contain exactly 2 products')

# 5. Check exact titles and prices from requirement table
expected = [
    ('fitness', 'Performance Athletic Track Pants', 1499, 1999),
    ('fitness', 'Performance Sports T-Shirt', 1299, 1799),
    ('casual', 'Classic Casual T-Shirt', 799, 1199),
    ('casual', 'Casual Denim Jeans', 1099, 1599),
    ('night', 'Comfortable Cotton Night Suit', 999, 1499),
    ('night', 'Satin Night Dress', 1199, 1699),
    ('party', 'Elegant Party Dress', 1499, 2199),
    ('party', 'Party Wear Shirt', 1399, 1999)
]

for i, (cat, title, p, op) in enumerate(expected):
    assert categories[i] == cat, f'Mismatch in category for {title}: {categories[i]} != {cat}'
    assert titles[i] == title, f'Mismatch in title: {titles[i]} != {title}'
    assert int(prices[i]) == p, f'Mismatch in price for {title}: {prices[i]} != {p}'
    assert int(orig_prices[i]) == op, f'Mismatch in origPrice for {title}: {orig_prices[i]} != {op}'
    
    # Check image URL resolves 200 OK on localhost and is a valid JPEG
    img_url = f'http://localhost:3000/{images[i]}'
    i_resp = urllib.request.urlopen(img_url)
    assert i_resp.status == 200, f'Image failed to load: {img_url}'
    img_data = i_resp.read()
    assert len(img_data) > 10000, f'Image too small: {len(img_data)}'
    assert img_data[:2] == b'\xff\xd8', f'Image {images[i]} is not a valid JPEG'
    print(f'  [OK] Product {i+1} [{cat.upper()}]: "{title}" - Price: Rs.{p} (Orig: Rs.{op}) - Image: {len(img_data)} bytes (JPEG valid)')

print('PASS 5: All 8 products match exact specifications and have 100% valid visible images!')

# 6. Verify detail angle images
for i, (cat, title, p, op) in enumerate(expected):
    detail_filename = images[i].replace('.jpg', '-detail.jpg')
    d_url = f'http://localhost:3000/{detail_filename}'
    d_resp = urllib.request.urlopen(d_url)
    assert d_resp.status == 200
    d_data = d_resp.read()
    assert d_data[:2] == b'\xff\xd8'
    print(f'  [OK] Detail Angle {i+1}: {detail_filename} - {len(d_data)} bytes (JPEG valid)')

print('PASS 6: All 8 multi-angle detail images verified!')
print('\n*** ALL 6 VERIFICATION TEST SUITES PASSED! ***')
