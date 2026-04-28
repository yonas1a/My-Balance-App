import re
import sys

filepath = r"c:\Users\VICTUS\Documents\Code\My Balance App\screens\HomeScreen.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add import if missing
if "AppColors" not in content:
    content = content.replace("import PinScreen from './PinScreen';", "import PinScreen from './PinScreen';\nimport { AppColors } from '../constants/theme';")

# Replace in JSX props (needs to change string to curly braces)
content = re.sub(r'color="#9CA3AF"|color=\{"#9CA3AF"\}', 'color={AppColors.subText}', content)
content = re.sub(r'color="#0B9600"|color=\{"#0B9600"\}', 'color={AppColors.primaryGreenStart}', content)
content = re.sub(r'color="#30FF1F"|color=\{"#30FF1F"\}', 'color={AppColors.primaryGreenEnd}', content)
content = re.sub(r'color="#EF4444"|color=\{"#EF4444"\}', 'color={AppColors.error}', content)
content = re.sub(r'color="#8B5CF6"|color=\{"#8B5CF6"\}', 'color={AppColors.primaryPurple}', content)

# Replace in Stylesheet (or outside JSX props)
content = re.sub(r"'#9CA3AF'", "AppColors.subText", content)
content = re.sub(r"'#f4f3f8'", "AppColors.background", content)
content = re.sub(r"'#26272c'", "AppColors.text", content)
content = re.sub(r"'#0B9600'", "AppColors.primaryGreenStart", content)
content = re.sub(r"'#30FF1F'", "AppColors.primaryGreenEnd", content)
content = re.sub(r"'#EF4444'", "AppColors.error", content)
content = re.sub(r"'#e5e7eb'", "AppColors.border", content)
content = re.sub(r"'#4ADE80'", "AppColors.success", content)
content = re.sub(r"'#8B5CF6'", "AppColors.primaryPurple", content)
content = re.sub(r"'#ffffffff'", "AppColors.card", content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
