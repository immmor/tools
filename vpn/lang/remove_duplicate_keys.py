#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to remove duplicate keys from JSON language files
"""

import json
import os
from pathlib import Path

# Language files to process
LANGUAGE_FILES = [
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-ar-SA.json",
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-en-US.json",
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-es-ES.json",
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-ja-JP.json",
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-ko-KR.json",
    "/Users/mrok/Documents/Coding/Web/tools/vpn/lang/index-ru-RU.json",
]


def remove_duplicate_keys_from_file(file_path):
    """
    Remove duplicate keys from a JSON file while preserving order.
    Returns tuple of (original_count, unique_count, duplicates_found)
    """
    print(f"\nProcessing: {file_path}")
    
    # Read the file content
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse JSON to detect duplicates manually
    # We need to check for duplicates before Python's dict automatically overwrites them
    duplicates = []
    seen_keys = set()
    unique_data = {}
    
    # Simple approach: load with json (which keeps last occurrence)
    # Then count occurrences in the original text
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON decode error: {e}")
        return None, None, None
    
    # Count lines to estimate original key count
    lines = content.strip().split('\n')
    key_lines = [line for line in lines if ':' in line and line.strip().startswith('"')]
    original_count = len(key_lines)
    
    # Check for duplicate keys by parsing line by line
    key_pattern = '"([^"]+)":'
    import re
    
    keys_in_order = []
    for line in lines:
        match = re.match(r'\s*"([^"]+)":', line)
        if match:
            key = match.group(1)
            keys_in_order.append(key)
    
    # Find duplicates
    seen = set()
    duplicate_keys = set()
    for key in keys_in_order:
        if key in seen:
            duplicate_keys.add(key)
        else:
            seen.add(key)
            unique_data[key] = data[key]
    
    unique_count = len(unique_data)
    
    if duplicate_keys:
        print(f"  ⚠️  Found {len(duplicate_keys)} duplicate key(s):")
        for key in sorted(duplicate_keys):
            count = keys_in_order.count(key)
            print(f"     - '{key}' appears {count} times")
        duplicates = list(duplicate_keys)
    else:
        print(f"  ✅ No duplicate keys found")
    
    # Write back only if there were duplicates
    if duplicates:
        # Write the cleaned JSON
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(unique_data, f, ensure_ascii=False, indent=4)
            f.write('\n')
        print(f"  ✓ Removed {original_count - unique_count} duplicate(s), kept {unique_count} unique keys")
    
    return original_count, unique_count, duplicates


def main():
    print("=" * 80)
    print("JSON Duplicate Key Remover")
    print("=" * 80)
    
    total_original = 0
    total_unique = 0
    all_duplicates = {}
    
    for file_path in LANGUAGE_FILES:
        if not os.path.exists(file_path):
            print(f"\n⚠️  File not found: {file_path}")
            continue
        
        original, unique, duplicates = remove_duplicate_keys_from_file(file_path)
        
        if original is not None:
            total_original += original
            total_unique += unique
            if duplicates:
                filename = os.path.basename(file_path)
                all_duplicates[filename] = duplicates
    
    print("\n" + "=" * 80)
    print("Summary")
    print("=" * 80)
    print(f"Total keys processed: {total_original}")
    print(f"Total unique keys: {total_unique}")
    print(f"Total duplicates removed: {total_original - total_unique}")
    
    if all_duplicates:
        print("\nFiles with duplicates:")
        for filename, dups in sorted(all_duplicates.items()):
            print(f"  - {filename}: {len(dups)} duplicate(s)")
    else:
        print("\n✅ No duplicates found in any file!")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
