from PIL import Image,ImageDraw
from pathlib import Path
for ep in ['ep-02','ep-03','ep-04','ep-05']:
 p=Path('artifacts/series-assets')/ep/'objects'
 if not p.exists():continue
 ids=sorted({f.name.split('-y')[0] for f in p.glob('*-p43.png')})
 out=Image.new('RGB',(1152,len(ids)*284),'#e4dfc8');d=ImageDraw.Draw(out)
 for r,id in enumerate(ids):
  d.text((8,r*284+2),id,fill='black')
  for c,y in enumerate([0,90,180,270]):out.paste(Image.open(p/f'{id}-y{y}-p43.png'),(c*288,r*284+24))
 out.save(p.parent/'contact.png')
