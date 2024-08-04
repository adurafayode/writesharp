from PIL import Image

# Sizes for the icons
sizes = [16, 48, 128]

for size in sizes:
    # Create a blank image with a white background
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    # Save the image with the appropriate size in the icons directory
    img.save('icons/icon{}.png'.format(size))

