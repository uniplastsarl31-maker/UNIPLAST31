"""Import the original UNIPLAST CSV without overwriting missing or conflicting data."""
from pathlib import Path
from decimal import Decimal, InvalidOperation
from collections import Counter
import argparse, csv, hashlib, json, re, shutil, uuid

ROOT=Path(__file__).resolve().parents[1]
NS=uuid.UUID('c960f82e-c3cf-42ae-87cf-1569ca582755')
FAMILIES=[('emballage','Emballages alimentaires','round-medium'),('crystal','Boîtes Crystal','crystal'),('conservation','Boîtes de conservation','square-tall'),('epices','Céréales & épices','square-tall'),('repas','Repas & pique-nique','lunchbox'),('bassines','Bassines & cuvettes','basin-10'),('seaux','Seaux & Clipso',''),('paniers','Paniers & corbeilles','basket'),('poubelles','Poubelles','bin'),('rangement','Rangement de la maison','basket'),('cuisine','Égouttoirs & accessoires','spinner-color'),('vaisselle','Vaisselle & service',''),('mobilier','Mobilier','royal-chair'),('hygiene','Hygiène & entretien',''),('nomade','Glacières & gourdes',''),('jardin','Pots & jardin',''),('divers','Autres accessoires','')]

def family(name):
    n=name.upper()
    if 'EMBALLAGE' in n:return 'emballage'
    if 'BOITE CRYSTAL' in n:return 'crystal'
    if any(s in n for s in ['CEREAL','EPICE','TAWABIL']):return 'epices'
    if any(s in n for s in ['SANDWICH','PORTE MANGER','PICNIQUE']):return 'repas'
    if n.startswith('BOITE'):return 'conservation'
    if n.startswith(('BASSINE','CUVETTE','RONDEAUX')):return 'bassines'
    if 'CLIPSO' in n or n.startswith('SEAUX'):return 'seaux'
    if 'POUBELLE' in n:return 'poubelles'
    if n.startswith(('PANIER','CORBEILLE')):return 'paniers'
    if n.startswith(('CHAISE','MAIDA','TABLE','TABOURET')):return 'mobilier'
    if n.startswith(('CHARIOT','COMMODE','CINTRE','PORTE CINTRE','PORTE STYLO','RANGE','SECHE')):return 'rangement'
    if n.startswith(('BROSSE','DISTRIBUTEUR','KIT DE BANIO','PELLE')):return 'hygiene'
    if n.startswith(('GLACIERE','GOURDE','BONBONNE')):return 'nomade'
    if n.startswith(('POT ','VASE')):return 'jardin'
    if n.startswith(('EGOUTTOIR','ESSOREUSE','ESSUIE','PASSOIRE','PRESSE','SUPPORT','PORTE OEUF','PORTE GOBLET')):return 'cuisine'
    if n.startswith(('BOL','BROC','CUILL','GOBLET','LOUCHE','PLATEAU','SALADIER','SERVICE','SHOP','VERRE','VERSEUR')):return 'vaisselle'
    return 'divers'

def uid(key):return str(uuid.uuid5(NS,key))
def number(s):
    s=re.sub(r'[\s\u00a0\u202f]','',s).replace(',','.')
    return Decimal(s) if s else None
def valid_barcode(s):
    if not re.fullmatch(r'\d{13}',s):return False
    return (10-sum(int(c)*(1 if i%2==0 else 3) for i,c in enumerate(s[:12]))%10)%10==int(s[12])
def quote(s):return "'"+s.replace("'","''")+"'"

def main():
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);args=ap.parse_args()
    source=args.source.resolve();raw_bytes=source.read_bytes();raw=list(csv.reader(raw_bytes.decode('utf-8-sig').splitlines()))
    header=next(i for i,r in enumerate(raw) if r and r[0].strip()=='Réf.')
    rows=[(i+1,r) for i,r in enumerate(raw) if i>header and len(r)>=15 and any(x.strip() for x in r)]
    refs=Counter(r[0].strip().casefold() for _,r in rows);bars=Counter(r[6].strip() for _,r in rows if r[6].strip())
    if any(n>1 for n in refs.values()):raise ValueError('Duplicate product references: resolve them before import.')
    photos={'PANIER TRESSE':'basket','BOITE SANDWICHE':'lunchbox','ESSOREUSE COULEUR':'spinner-color','BASSINE 10 L':'basin-10','BASSINE 25 L':'basin-25'}
    products=[];issues=[]
    for line,r in rows:
        ref,name,pack,price,weight,bar,cap,dims=[r[i].strip() for i in [0,2,3,4,5,6,8,9]]
        notes=[];p=number(price);q=number(pack)
        if q is None or q!=int(q) or q<1 or q>10000:raise ValueError(f'Invalid pack size on line {line}')
        if p is not None and (p<0 or p>1000000):raise ValueError(f'Invalid price on line {line}')
        if p is None:notes.append('Prix absent : vente bloquée jusqu’à saisie du tarif.')
        accepted_bar=bar or None
        if bar and bars[bar]>1:accepted_bar=None;notes.append('Code-barres partagé par plusieurs références : à vérifier.')
        elif bar and not valid_barcode(bar):accepted_bar=None;notes.append('Code-barres EAN-13 invalide : à vérifier.')
        elif not bar:notes.append('Code-barres absent du fichier source.')
        # The right-hand Code/Name/Capacity/Dimensions is an independent list.
        # Never attach those cells to the left-hand product merely by row number.
        if cap=='-':cap=''
        if dims=='-':dims=''
        display=re.sub(r'\s+',' ',name).strip()
        if '/STOCK=' in display:
            display=display.split('/STOCK=')[0].strip();notes.append('Ancienne annotation de stock conservée dans la source, non utilisée comme stock actuel.')
        if not cap:
            m=re.search(r'(\d+(?:[.,]\d+)?)\s*(ML|L)\b',display,re.I)
            if m:cap=m.group(0);notes.append('Capacité reprise explicitement du libellé produit.')
        photo=photos.get(display,'');images=[{'url':f'/assets/{photo}.webp','scale':1,'x':0,'y':0}] if photo else []
        product={'id':uid('product:'+ref),'name':display,'name_fr':display,'code':ref,'barcode':accepted_bar,'family_id':uid('family:'+family(display)),
          'description':'Produit du catalogue UNIPLAST. Les caractéristiques affichées proviennent du fichier fourni.','dimensions':dims,'capacity':cap,'material':'',
          'pack_size':int(q),'pack_label':'carton','unit_price_cents':int((p*100).quantize(Decimal('1'))) if p is not None else 0,'price_on_request':p is None,
          'available':False,'availability_confirmed':False,'stock_cartons':None,'is_new':False,'upcoming':False,'preorder_enabled':False,
          'discount_price_cents':None,'discount_start':None,'discount_end':None,'offer_title':'','show_offer':True,'pinned':bool(photo),'sort_order':len(products),
          'images':images,'created_at':'2026-10-27T00:00:00Z','source_metadata':{'row':line,'original_barcode':bar,'weight':weight,'notes':notes}}
        products.append(product)
        if notes:issues.append({'code':ref,'name':display,'row':line,'notes':notes})
    families=[{'id':uid('family:'+k),'name':n,'name_fr':n,'image':f'/assets/{im}.webp' if im else '', 'sort_order':i,'visible':True} for i,(k,n,im) in enumerate(FAMILIES) if any(p['family_id']==uid('family:'+k) for p in products)]
    report={'source':'uniplast_produits.csv','sha256':hashlib.sha256(raw_bytes).hexdigest(),'imported_at':'2026-10-27','products':len(products),'families':len(families),
      'missing_prices':sum(p['price_on_request'] for p in products),'duplicate_barcodes':{b:n for b,n in bars.items() if n>1},'missing_source_barcodes':sum(not r[6].strip() for _,r in rows),
      'matched_images':sum(bool(p['images']) for p in products),'availability':'Not provided. All products require admin confirmation before purchase.',
      'mapping':'Left-hand Réf., Libellé, Colisage, P.V. TTC, Poids, Code barre, Capacity, Dimensions. Right-hand list deliberately not joined by row.',
      'price_interpretation':'P.V. TTC treated as the unit price in DZD. No tax rate is invented. Original decimal precision preserved in centimes.',
      'family_counts':{f['name']:sum(p['family_id']==f['id'] for p in products) for f in families},'issues':issues}
    for d in ['src/data','data','docs','supabase']: (ROOT/d).mkdir(exist_ok=True,parents=True)
    (ROOT/'src/data/catalog.json').write_text(json.dumps({'products':products,'families':families},ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'docs/import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    md=f'# Import du catalogue UNIPLAST\n\n{len(products)} références importées dans {len(families)} familles.\n\n- {report["missing_prices"]} prix absents : affichage « Prix sur demande ».\n- {len(report["duplicate_barcodes"])} codes-barres partagés : champ actif laissé vide pour toutes les références concernées, valeur originale conservée dans le rapport.\n- {report["missing_source_barcodes"]} codes-barres absents du CSV.\n- Disponibilité non fournie : validation par l’administrateur requise avant la vente.\n- P.V. TTC interprété comme prix unitaire TTC en DZD. Aucun taux de TVA ajouté.\n- La liste indépendante de droite n’a pas été associée arbitrairement par numéro de ligne.\n- Aucune promotion, vente, nouveauté ou date de lancement inventée.\n\nSHA-256 de la source : `{report["sha256"]}`.\n\nVoir import-report.json pour les anomalies de chaque référence.\n'
    (ROOT/'docs/import-report-fr.md').write_text(md,encoding='utf-8')
    sql=['-- Source catalogue import. Run AFTER migrations. No fabricated availability or discounts.','begin;']
    for f in families:
        sql.append('insert into public.families (id,name,name_fr,image,sort_order,visible) values ('+','.join(quote(str(f[k])) if k not in ['sort_order','visible'] else str(f[k]).lower() for k in ['id','name','name_fr','image','sort_order','visible'])+') on conflict (id) do nothing;')
    for p in products:
        # jsonb_populate_record ensures numeric, JSON and boolean fields retain their types.
        sql.append('insert into public.products select (jsonb_populate_record(null::public.products,'+quote(json.dumps(p,ensure_ascii=False))+'::jsonb)).* on conflict (id) do nothing;')
    sql.append('commit;')
    (ROOT/'supabase/seed-catalog.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
    target=ROOT/'data/uniplast_produits.csv'
    if target.resolve()!=source:shutil.copy2(source,target)
    print(json.dumps({k:v for k,v in report.items() if k not in ['issues']},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
