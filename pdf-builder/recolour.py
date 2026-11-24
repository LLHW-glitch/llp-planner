# Recolour her White planner into any colourway by remapping the grey accents in the vector artwork.
import pikepdf,sys
TONES={'arctic':('#ffffff','#1b1b1b'),'midnight':('#ffffff','#1b1b1b'),'linen':('#faf0e6','#935927'),'blush':('#ffe7ef','#ef90ab'),'sky':('#d7f2ff','#0091d7'),'breeze':('#e0f2ec','#50b694'),'orchid':('#f2eafb','#b48fe0'),'shea':('#f1eae4','#b18a70'),'slate':('#b1c0cd','#4a6174'),'dustyrose':('#e7cbcb','#d7a9a9')}
h=lambda c:[int(c[i:i+2],16)/255 for i in (1,3,5)]
def mapper(tone):
    light,line=map(h,TONES[tone])
    def f(rgb):
        r,g,b=rgb
        if max(rgb)-min(rgb)>0.03: return None          # already coloured: leave it
        v=(r+g+b)/3
        if v<=0.02 or v>=0.985: return None              # black text and white paper stay as they are
        t=max(0,min(1,(v-0.106)/(0.93-0.106)))           # her darkest accent grey is 0.106, lightest fill about 0.93
        if t<0.55: tt=t/0.55; return [line[i]*(1-tt)+mix_i for i,mix_i in enumerate([(line[i]*0.55+light[i]*0.45)*tt for i in range(3)])]
        tt=(t-0.55)/0.45; return [(line[i]*0.55+light[i]*0.45)*(1-tt)+light[i]*tt for i in range(3)]
    return f
def recolour_stream(obj,f,seen):
    if obj.objgen in seen: return
    seen.add(obj.objgen)
    ops=pikepdf.parse_content_stream(obj); out=[]; changed=False
    for operands,op in ops:
        o=str(op)
        if o in ('scn','SCN','sc','SC','rg','RG') and len(operands)==3 and all(not isinstance(x,pikepdf.Name) for x in operands):
            n=f([float(x) for x in operands])
            if n: operands=[round(x,4) for x in n]; changed=True
        out.append((operands,op))
    if changed: obj.write(pikepdf.unparse_content_stream(out))
    res=obj.get('/Resources')
    if res is not None:
        for k,x in (res.get('/XObject') or {}).items():
            if x.get('/Subtype')=='/Form': recolour_stream(x,f,seen)
def recolour(pdf,tone):
    f=mapper(tone); seen=set()
    for p in pdf.pages:
        # page content
        ops=pikepdf.parse_content_stream(p); out=[]
        for operands,op in ops:
            o=str(op)
            if o in ('scn','SCN','sc','SC','rg','RG') and len(operands)==3 and all(not isinstance(x,pikepdf.Name) for x in operands):
                n=f([float(x) for x in operands])
                if n: operands=[round(x,4) for x in n]
            out.append((operands,op))
        p.obj['/Contents']=pdf.make_stream(pikepdf.unparse_content_stream(out))
        for k,x in (p.Resources.get('/XObject') or {}).items():
            if x.get('/Subtype')=='/Form': recolour_stream(x,f,seen)
if __name__=='__main__':
    src,tone,pages,out=sys.argv[1],sys.argv[2],[int(x) for x in sys.argv[3].split(',')],sys.argv[4]
    pdf=pikepdf.open(src); new=pikepdf.new()
    for n in pages: new.pages.append(pdf.pages[n-1])
    recolour(new,tone); new.save(out)
