import openpyxl
import psycopg2
import os

# Database connection
DB_URL = "postgres://videovault:9c2a2f8e9a7c4a8d9f3b7e2c6d1a4b7e@localhost:5432/videovault"

def import_tags():
    print("Loading workbook...")
    wb = openpyxl.load_workbook('/home/patrick/VideoVault/docs/taglist.xlsx')
    sheet = wb.active
    
    print("Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    count_inserted = 0
    
    print("Processing rows...")
    for row in sheet.iter_rows(values_only=True):
        if not row or not row[0]:
            continue
            
        raw_val = row[0] # "0-pussy 106,104"
        
        # Replace non-breaking space with space
        val = str(raw_val).replace('\xa0', ' ')
        
        # Find the last space to separate name and count
        last_space_idx = val.rfind(' ')
        
        if last_space_idx != -1:
            name = val[:last_space_idx].strip()
            count_str = val[last_space_idx+1:].strip().replace(',', '')
            try:
                count = int(count_str)
            except ValueError:
                name = val
                count = 0
        else:
            name = val
            count = 0
            
        # Insert into database
        # We check if name exists to avoid duplicates (assuming name is unique enough or we don't care about exact dups if schema doesn't enforce unique name, but schema has index on name)
        # Schema doesn't enforce unique name, but we should probably avoid inserting same tag multiple times.
        # Let's check if it exists first.
        cur.execute("SELECT id FROM tags WHERE name = %s", (name,))
        if cur.fetchone():
            continue

        cur.execute("""
            INSERT INTO tags (name, count, type)
            VALUES (%s, %s, 'imported')
        """, (name, count))
        count_inserted += 1
        
        if count_inserted % 100 == 0:
            print(f"Processed {count_inserted} tags...")
        
    conn.commit()
    cur.close()
    conn.close()
    print(f"Successfully imported {count_inserted} tags.")

if __name__ == "__main__":
    import_tags()
