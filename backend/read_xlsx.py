import zipfile
import xml.etree.ElementTree as ET
import sys

def read_xlsx(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            # Read shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                # XML namespace handling
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('main:si', ns):
                    t = si.find('main:t', ns)
                    if t is not None and t.text:
                        shared_strings.append(t.text)
                    else:
                        # Sometimes text is nested in <r> elements
                        text = ""
                        for r in si.findall('main:r', ns):
                            t_node = r.find('main:t', ns)
                            if t_node is not None and t_node.text:
                                text += t_node.text
                        shared_strings.append(text)
            
            # Read the first worksheet
            if 'xl/worksheets/sheet1.xml' in z.namelist():
                sheet_content = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(sheet_content)
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                rows = root.findall('.//main:row', ns)
                for row in rows:
                    row_data = []
                    for c in row.findall('main:c', ns):
                        t_attr = c.get('t')
                        
                        # Handle inline strings
                        if t_attr == 'inlineStr':
                            is_node = c.find('main:is', ns)
                            if is_node is not None:
                                t_node = is_node.find('main:t', ns)
                                if t_node is not None and t_node.text:
                                    row_data.append(t_node.text)
                                    continue
                        
                        # Handle shared strings or numbers
                        v_node = c.find('main:v', ns)
                        if v_node is not None and v_node.text:
                            if t_attr == 's': # shared string
                                idx = int(v_node.text)
                                if idx < len(shared_strings):
                                    row_data.append(shared_strings[idx])
                                else:
                                    row_data.append("")
                            else:
                                row_data.append(v_node.text)
                        else:
                            row_data.append("")
                            
                    # Filter empty rows
                    if any(str(x).strip() for x in row_data):
                        print(" | ".join(str(x).replace('\n', ' ') for x in row_data))
                        
    except Exception as e:
        print(f"Error reading xlsx: {e}")

if __name__ == '__main__':
    read_xlsx('../theme_2.xlsx')
