# Measures each long straight accent line separately (by position and extent) at 300dpi and reports thick ones.
import sys,subprocess,os
import numpy as np
from PIL import Image
pdf,pages,col=sys.argv[1],[int(x) for x in sys.argv[2].split(',')],sys.argv[3]
G=np.array([int(col[i:i+2],16) for i in (1,3,5)])
os.makedirs('tk',exist_ok=True); allbad={}
for n in pages:
    f=f'tk/p{n}'
    subprocess.run(['pdftoppm','-r','200','-f',str(n),'-l',str(n),'-singlefile','-png',pdf,f],check=True)
    a=np.asarray(Image.open(f+'.png').convert('RGB')).astype(int)[60:-60,:int(1700*0.935)]
    m=np.abs(a-G).sum(2)<150
    bad=[]
    for axis in (0,1):
        mm=m if axis==0 else m.T
        segs={}  # open segments keyed by (start,end) bucket
        open_=[]
        for i,row in enumerate(mm):
            r=np.diff(np.concatenate(([0],row.astype(np.int8),[0]))); st=np.where(r==1)[0]; en=np.where(r==-1)[0]
            runs=[(s,e) for s,e in zip(st,en) if e-s>=100]
            new=[]
            for s,e in runs:
                hit=None
                for o in open_:
                    if o['last']==i-1 and min(e,o['e'])-max(s,o['s'])>70: hit=o; break
                if hit: hit['last']=i; hit['n']+=1; new.append(hit)
                else: new.append({'s':s,'e':e,'first':i,'last':i,'n':1})
            for o in open_:
                if o not in new and o['n']>=4: bad.append(('H' if axis==0 else 'V', round((o['first']+(60 if axis==0 else 0))*72/200,1), round(o['s']*72/200,1), o['n']))
            open_=new
    allbad[n]=bad; os.remove(f+'.png')
    print(n, 'thick lines:', bad[:8])
