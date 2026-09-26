import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630

# Create base canvas
img = Image.new("RGBA", (W, H), (10, 15, 26, 255))

# Draw smooth ambient glows
glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)

# Radial glow 1: Warm orange glow in top-right
for r in range(400, 0, -10):
    alpha = int(45 * (1 - r / 400))
    glow_draw.ellipse([950 - r, 120 - r, 950 + r, 120 + r], fill=(234, 88, 12, alpha))

# Radial glow 2: Soft amber/orange in center-top
for r in range(300, 0, -10):
    alpha = int(25 * (1 - r / 300))
    glow_draw.ellipse([600 - r, 0 - r, 600 + r, 0 + r], fill=(249, 115, 22, alpha))

# Radial glow 3: Deep blue glow in bottom-left
for r in range(350, 0, -10):
    alpha = int(35 * (1 - r / 350))
    glow_draw.ellipse([200 - r, 550 - r, 200 + r, 550 + r], fill=(30, 58, 138, alpha))

# Blend glow
img = Image.alpha_composite(img, glow_layer)

# Draw subtle concentric ambient circles in the background
circles_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
circ_draw = ImageDraw.Draw(circles_layer)
center_x, center_y = 1000, 180
for radius in [120, 200, 300, 420, 560, 720]:
    circ_draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        outline=(255, 255, 255, 12),
        width=1
    )
img = Image.alpha_composite(img, circles_layer)

# Setup Fonts
def get_font(name, size):
    fonts_dir = "C:/Windows/Fonts"
    path = os.path.join(fonts_dir, name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    # Fallback to standard arial or segoeui
    fallback = os.path.join(fonts_dir, "arial.ttf")
    if os.path.exists(fallback):
        return ImageFont.truetype(fallback, size)
    return ImageFont.load_default()

font_title = get_font("georgiab.ttf", 74)
font_badge = get_font("segoeuib.ttf", 20)
font_sub = get_font("segoeui.ttf", 26)
font_sub_bold = get_font("segoeuib.ttf", 26)
font_url = get_font("segoeuib.ttf", 22)
font_card = get_font("segoeuib.ttf", 18)
font_code = get_font("consola.ttf", 16)

draw = ImageDraw.Draw(img)

# --- Decorative Flanking Cards (Outside the Center Safe Zone) ---
# Left Flanking Card: Trophy / Achievement Card (around x=45, y=195)
card_left = Image.new("RGBA", (180, 220), (0, 0, 0, 0))
cl_draw = ImageDraw.Draw(card_left)
# Card background
cl_draw.rounded_rectangle([0, 0, 178, 218], radius=22, fill=(19, 29, 49, 220), outline=(255, 255, 255, 35), width=1)
# Header
cl_draw.rounded_rectangle([0, 0, 178, 38], radius=22, fill=(28, 40, 65, 230))
cl_draw.rectangle([0, 20, 178, 38], fill=(28, 40, 65, 230))
cl_draw.text((18, 11), "COMPETITIONS", font=get_font("segoeuib.ttf", 11), fill=(251, 146, 60, 240))
# Trophy icon / golden accent
cl_draw.ellipse([55, 52, 125, 122], fill=(234, 88, 12, 35), outline=(234, 88, 12, 90), width=1)
# Simple stylized trophy shape
cl_draw.polygon([(73, 66), (107, 66), (102, 94), (93, 102), (87, 102), (78, 94)], fill=(245, 158, 11, 240))
cl_draw.rectangle([87, 102, 93, 112], fill=(245, 158, 11, 240))
cl_draw.rounded_rectangle([76, 112, 104, 118], radius=3, fill=(245, 158, 11, 240))
# Handles
cl_draw.arc([66, 70, 80, 90], start=90, end=270, fill=(245, 158, 11, 200), width=3)
cl_draw.arc([100, 70, 114, 90], start=270, end=90, fill=(245, 158, 11, 200), width=3)
# Label
cl_draw.text((90, 140), "Daily Live Quiz", font=get_font("segoeuib.ttf", 15), fill=(241, 245, 249, 230), anchor="mt")
cl_draw.text((90, 166), "National Leaderboard", font=get_font("segoeui.ttf", 13), fill=(148, 163, 184, 200), anchor="mt")
# Bottom mini badge
cl_draw.rounded_rectangle([34, 190, 146, 208], radius=9, fill=(234, 88, 12, 30), outline=(234, 88, 12, 80), width=1)
cl_draw.text((90, 199), "Win & Learn", font=get_font("segoeuib.ttf", 11), fill=(253, 186, 116, 255), anchor="mm")

img.paste(card_left, (45, 195), card_left)

# Right Flanking Card: Code Editor Card (around x=975, y=195)
card_right = Image.new("RGBA", (185, 225), (0, 0, 0, 0))
cr_draw = ImageDraw.Draw(card_right)
cr_draw.rounded_rectangle([0, 0, 183, 223], radius=22, fill=(19, 29, 49, 220), outline=(255, 255, 255, 35), width=1)
# Header bar
cr_draw.rounded_rectangle([0, 0, 183, 38], radius=22, fill=(28, 40, 65, 230))
cr_draw.rectangle([0, 20, 183, 38], fill=(28, 40, 65, 230))
# Dots
cr_draw.ellipse([14, 14, 22, 22], fill=(239, 68, 68, 220))
cr_draw.ellipse([28, 14, 36, 22], fill=(245, 158, 11, 220))
cr_draw.ellipse([42, 14, 50, 22], fill=(16, 185, 129, 220))
cr_draw.text((120, 12), "solution.py", font=get_font("segoeui.ttf", 12), fill=(148, 163, 184, 200))
# Code lines
cr_draw.text((16, 52), "def practice():", font=font_code, fill=(249, 115, 22, 240))
cr_draw.text((28, 76), "score = 100", font=font_code, fill=(56, 189, 248, 230))
cr_draw.text((28, 100), "return win", font=font_code, fill=(52, 211, 153, 230))
cr_draw.text((16, 128), "class Quiz:", font=font_code, fill=(168, 85, 247, 230))
cr_draw.text((28, 152), "status = True", font=font_code, fill=(251, 146, 60, 220))
# Subtle progress fill at bottom
cr_draw.rounded_rectangle([16, 190, 168, 198], radius=4, fill=(40, 53, 76, 255))
cr_draw.rounded_rectangle([16, 190, 130, 198], radius=4, fill=(234, 88, 12, 255))

img.paste(card_right, (970, 195), card_right)


# --- CENTER SAFE ZONE (All primary branding centered horizontally) ---
center_x = W // 2

# 1. Top Pill Badge: INTERACTIVE LEARNING PLATFORM
badge_text = "INTERACTIVE LEARNING PLATFORM"
bbox = font_badge.getbbox(badge_text)
bw = bbox[2] - bbox[0] + 54
bh = bbox[3] - bbox[1] + 16
bx1 = center_x - bw // 2
by1 = 92
bx2 = bx1 + bw
by2 = by1 + bh

# Badge frosted background
badge_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
b_draw = ImageDraw.Draw(badge_img)
b_draw.rounded_rectangle([bx1, by1, bx2, by2], radius=bh // 2, fill=(234, 88, 12, 26), outline=(234, 88, 12, 90), width=1)
# Small glowing dot on the left of the badge
b_draw.ellipse([bx1 + 16, by1 + bh // 2 - 4, bx1 + 24, by1 + bh // 2 + 4], fill=(249, 115, 22, 255))
b_draw.text((center_x + 8, by1 + bh // 2), badge_text, font=font_badge, fill=(251, 146, 60, 255), anchor="mm")
img = Image.alpha_composite(img, badge_img)

# 2. Main Title: B. Prasad Shah
title_text = "B. Prasad Shah"
title_y = 222

# Drop shadow
shadow_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
s_draw = ImageDraw.Draw(shadow_img)
s_draw.text((center_x, title_y + 4), title_text, font=font_title, fill=(0, 0, 0, 190), anchor="mm")
shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=8))
img = Image.alpha_composite(img, shadow_img)

# Title text (warm off-white/cream)
t_draw = ImageDraw.Draw(img)
t_draw.text((center_x, title_y), title_text, font=font_title, fill=(255, 255, 255, 255), anchor="mm")

# 3. Subtitle / Features Row: MCQ Hub • Python Hub • Live Quiz • Resources
feature_y = 330
pill_features = [
    ("MCQ Hub", (234, 88, 12)),
    ("Python Hub", (56, 189, 248)),
    ("Live Quiz", (245, 158, 11)),
    ("Study Resources", (16, 185, 129))
]

# Calculate total width for pill tags
pill_w_list = []
for label, _ in pill_features:
    t_box = font_sub_bold.getbbox(label)
    pill_w_list.append((t_box[2] - t_box[0]) + 30)

spacing = 14
total_pills_w = sum(pill_w_list) + spacing * (len(pill_features) - 1)
cur_x = center_x - total_pills_w // 2

pills_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
p_draw = ImageDraw.Draw(pills_layer)

for i, (label, color) in enumerate(pill_features):
    pw = pill_w_list[i]
    ph = 44
    py = feature_y - ph // 2
    # Pill background
    p_draw.rounded_rectangle(
        [cur_x, py, cur_x + pw, py + ph],
        radius=ph // 2,
        fill=(color[0], color[1], color[2], 30),
        outline=(color[0], color[1], color[2], 85),
        width=1
    )
    p_draw.text((cur_x + pw // 2, py + ph // 2), label, font=font_sub_bold, fill=(255, 255, 255, 240), anchor="mm")
    cur_x += pw + spacing

img = Image.alpha_composite(img, pills_layer)

# 4. Description line
desc_text = "Free interactive practice quizzes, Loksewa, CS & coding tutorials"
d_draw = ImageDraw.Draw(img)
d_draw.text((center_x, 410), desc_text, font=font_sub, fill=(148, 163, 184, 230), anchor="mm")

# 5. Bottom URL Badge: bholaprasadshah.com.np
url_text = "bholaprasadshah.com.np"
ubox = font_url.getbbox(url_text)
uw = ubox[2] - ubox[0] + 56
uh = 46
ux1 = center_x - uw // 2
uy1 = 490
ux2 = ux1 + uw
uy2 = uy1 + uh

url_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
u_draw = ImageDraw.Draw(url_layer)
# Frosted pill
u_draw.rounded_rectangle([ux1, uy1, ux2, uy2], radius=uh // 2, fill=(255, 255, 255, 18), outline=(255, 255, 255, 45), width=1)
# Green status dot
u_draw.ellipse([ux1 + 18, uy1 + uh // 2 - 5, ux1 + 28, uy1 + uh // 2 + 5], fill=(34, 197, 94, 255))
u_draw.text((ux1 + 38, uy1 + uh // 2), url_text, font=font_url, fill=(241, 245, 249, 255), anchor="lm")

img = Image.alpha_composite(img, url_layer)

# Convert to RGB and save as high-quality JPEG
final_img = img.convert("RGB")
out_path = "assets/og-image.jpg"
final_img.save(out_path, "JPEG", quality=95, optimize=True)
print(f"Successfully generated {out_path} with size {final_img.size}")
