import sys
from PIL import Image

if len(sys.argv) < 3:
    print("Usage: python convert_icon.py input.png output.ico")
    sys.exit(1)

input_path = sys.argv[1]
output_path = sys.argv[2]
img = Image.open(input_path)
img.save(output_path, format='ICO', sizes=[(256, 256)])
print(f"Converted {input_path} to {output_path}")
