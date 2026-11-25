# Finds long straight lines that are grey/black instead of the accent colour, on every page.
import sys,subprocess,glob,os
from PIL import Image
pdf=sys.argv[1]; out='lc'; os.makedirs(out,exist_ok=True)
for f in glob.glob(out+'/*'): os.remove(f)
subprocess.run(['pdftoppm','-r','72','-png',pdf,out+'/p'],check=True)
bad=[]
for f in sorted(glob.glob(out+'/p-*.png')):
    im=Image.open(f).convert('RGB'); W,H=im.size; px=im.load(); n=int(f.split('-')[-1][:-4])
    def grey(c): r,g,b=c; return max(r,g,b)-min(r,g,b)<12 and r<170
    hits=0
    for y in range(22,H-22,1):
        run=0
        for x in range(0,int(W*0.94)):
            if grey(px[x,y]): run+=1
            else:
                if run>=60: hits+=1
                run=0
    for x in range(0,int(W*0.94),1):
        run=0
        for y in range(22,H-22):
            if grey(px[x,y]): run+=1
            else:
                if run>=60: hits+=1
                run=0
    if hits: bad.append((n,hits))
print('pages with grey/black lines:',len(bad)); print(bad[:60])
