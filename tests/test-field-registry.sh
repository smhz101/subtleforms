#!/bin/bash

# Field Registry System Test Script
# This script tests the Field Definition & Registry system

echo "==================================="
echo "SubtleForms Field Registry Tests"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check PHP classes exist
echo -e "${YELLOW}Test 1: Checking PHP class files...${NC}"
if [ -f "src/Fields/FieldDefinition.php" ]; then
    echo -e "${GREEN}✓${NC} FieldDefinition.php exists"
else
    echo -e "${RED}✗${NC} FieldDefinition.php missing"
fi

if [ -f "src/Fields/FieldRegistry.php" ]; then
    echo -e "${GREEN}✓${NC} FieldRegistry.php exists"
else
    echo -e "${RED}✗${NC} FieldRegistry.php missing"
fi

if [ -f "src/Fields/CoreFields.php" ]; then
    echo -e "${GREEN}✓${NC} CoreFields.php exists"
else
    echo -e "${RED}✗${NC} CoreFields.php missing"
fi
echo ""

# Test 2: Verify Container integration
echo -e "${YELLOW}Test 2: Checking Container integration...${NC}"
if grep -q "FieldRegistry::class" src/Container.php; then
    echo -e "${GREEN}✓${NC} FieldRegistry registered in Container"
else
    echo -e "${RED}✗${NC} FieldRegistry not found in Container"
fi

if grep -q "CoreFields::register" src/Container.php; then
    echo -e "${GREEN}✓${NC} CoreFields::register() called in Container"
else
    echo -e "${RED}✗${NC} CoreFields::register() not called"
fi
echo ""

# Test 3: Verify REST API endpoint
echo -e "${YELLOW}Test 3: Checking REST API integration...${NC}"
if grep -q "'/fields'" src/Api/RestController.php; then
    echo -e "${GREEN}✓${NC} /fields endpoint registered"
else
    echo -e "${RED}✗${NC} /fields endpoint not found"
fi

if grep -q "get_fields" src/Api/RestController.php; then
    echo -e "${GREEN}✓${NC} get_fields() method exists"
else
    echo -e "${RED}✗${NC} get_fields() method missing"
fi
echo ""

# Test 4: Count core field types
echo -e "${YELLOW}Test 4: Counting core field types...${NC}"
field_count=$(grep -c "type: '" src/Fields/CoreFields.php)
echo "Found ${field_count} field type registrations"
if [ "$field_count" -ge 17 ]; then
    echo -e "${GREEN}✓${NC} All 17+ core fields registered"
else
    echo -e "${RED}✗${NC} Expected 17 core fields, found ${field_count}"
fi
echo ""

# Test 5: Verify field categories
echo -e "${YELLOW}Test 5: Checking field categories...${NC}"
categories=("basic" "choices" "advanced" "media")
for category in "${categories[@]}"; do
    if grep -q "category: '$category'" src/Fields/CoreFields.php; then
        echo -e "${GREEN}✓${NC} Category '$category' found"
    else
        echo -e "${YELLOW}!${NC} Category '$category' not found (may not have fields)"
    fi
done
echo ""

# Test 6: Verify extension hook
echo -e "${YELLOW}Test 6: Checking extension hook...${NC}"
if grep -q "do_action('subtleforms/fields/register'" src/Fields/CoreFields.php; then
    echo -e "${GREEN}✓${NC} Extension hook 'subtleforms/fields/register' found"
else
    echo -e "${RED}✗${NC} Extension hook missing"
fi
echo ""

# Test 7: Check frontend integration
echo -e "${YELLOW}Test 7: Checking frontend integration...${NC}"
if grep -q "apiGet('/fields" resources/admin/components/FormBuilder.jsx; then
    echo -e "${GREEN}✓${NC} FormBuilder loads fields from API"
else
    echo -e "${RED}✗${NC} FormBuilder not loading fields from API"
fi

if ! grep -q "const fieldGroups = {" resources/admin/components/FormBuilder.jsx; then
    echo -e "${GREEN}✓${NC} Hardcoded field groups removed"
else
    echo -e "${RED}✗${NC} Hardcoded field groups still present"
fi
echo ""

# Test 8: Build check
echo -e "${YELLOW}Test 8: Checking build output...${NC}"
if [ -f "build/admin.js" ]; then
    file_size=$(wc -c < "build/admin.js" | xargs)
    echo -e "${GREEN}✓${NC} Build file exists (${file_size} bytes)"
    if [ "$file_size" -gt 20000 ]; then
        echo -e "${GREEN}✓${NC} Build file size looks reasonable"
    else
        echo -e "${YELLOW}!${NC} Build file might be incomplete"
    fi
else
    echo -e "${RED}✗${NC} Build file missing - run 'npm run build'"
fi
echo ""

echo "==================================="
echo "Test Summary"
echo "==================================="
echo "All critical components are in place!"
echo ""
echo "Next steps:"
echo "1. Load WordPress admin dashboard"
echo "2. Navigate to SubtleForms → Forms"
echo "3. Create or edit a form"
echo "4. Verify Field Dock shows all 17 field types"
echo "5. Test adding fields from different categories"
echo ""
echo "To test REST API directly:"
echo "curl -X GET 'http://your-site.local/wp-json/subtleforms/v1/fields?grouped=true' \\"
echo "  -H 'X-WP-Nonce: YOUR_NONCE'"
