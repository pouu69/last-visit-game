import { episodeKit } from './model-kit.mjs';
export function createEpisode02Props(core) {
  const {group,box,cylinder,beam,ring,p,material,label,end,factory,physical,keep}=episodeKit(core,'ep-02');
  const blue=material('#527586',{roughness:.91});
  function stand(root,x=0) {
    for(const z of [-.36,.36]) beam(root,p.wood,[x,.98,0],[x,0.04,z],.04);
    beam(root,p.brass,[x,.4,-.23],[x,.4,.23],.025);
  }
  function sign(id,{reversed=false}={}) {
    const root=group(id); stand(root,-.68);stand(root,.68);
    const panel=group('direction-panel');root.add(panel);panel.position.y=1.16;
    box(panel,blue,[0,0,0],[1.82,.72,.09]);
    const front=label(panel,id==='double-sign'?'출발 → 위쪽 쉼터':'강변 직행 →',[0,0,.056],[1.68,.55,.012]);
    const rear=label(panel,id==='double-sign'?'귀환 ← 역 뒤뜰':'← 돌아오는 길',[0,id==='double-sign'?0:-.17,-.056],[id==='double-sign'?1.68:.8,id==='double-sign'?.55:.22,.012],[0,Math.PI,0]);
    if(reversed) root.rotation.y=Math.PI;
    return end(root,id,1.82,.8,1.52,{panel,front,rear},[physical(1.82,.8,1.52)]);
  }
  const builders={
    'route-sign':o=>sign('route-sign',o), 'double-sign':o=>sign('double-sign',o),
    'sign-stand'() {const root=group('sign-stand');stand(root,-.5);stand(root,.5);box(root,p.wood,[0,.98,0],[1.2,.09,.12]);return end(root,'sign-stand',1.2,.8,1.03,{},[physical(1.2,.8,1.03)]);},
    'return-crate'({open=false}={}) {
      const root=group('returned-freight');
      box(root,p.wood,[0,.07,0],[2,.14,.8]);
      for(const x of [-.95,.95]) box(root,p.wood,[x,.36,0],[.1,.6,.8]);
      for(const z of [-.35,.35]) box(root,p.wood,[0,.36,z],[2,.6,.1]);
      for(const x of [-.65,.65]) for(const z of [-.414,.414]) box(root,p.brass,[x,.35,z],[.06,.65,.02]);
      const lid=group('crate-lid');root.add(lid);lid.position.set(0,.68,-.4);
      box(lid,p.wood,[0,0,.4],[2,.1,.8]);lid.rotation.x=open?-Math.PI*.65:0;
      for(let i=0;i<3;i++) label(root,['반송 1 · 주소 불일치','반송 2 · 수취인 확인','반송 3 · 현장 인계'][i],[-.38+i*.32,.32+i*.05,.414+i*.014],[.76,.26,.012],[0,0,-.12+i*.1]);
      label(root,'옛 인수 사진',[0,.16,0],[.65,.012,.38],[-Math.PI/2,0,0]);
      return end(root,'return-crate',2,.86,.78,{lid},[physical(2,.86,.78)]);
    },
    'folded-map'({open=true}={}) {
      const root=group('two-direction-map');
      const left=group('map-outbound'),right=group('map-return');root.add(left,right);
      label(left,'출발\n역 뒤뜰 → 위쪽 쉼터',[-.3,.016,0],[.6,.55,.016],[-Math.PI/2,0,0]);
      label(right,'귀환\n위쪽 쉼터 → 역 뒤뜰',[.3,.016,0],[.6,.55,.016],[-Math.PI/2,0,0]);
      if(!open)right.rotation.z=Math.PI;
      return end(root,'folded-map',1.2,.55,.04,{left,right},[],'support-center');
    },
    'station-clock'() {
      const root=group('clock-1117');cylinder(root,p.brass,[0,0,0],[.5,.09,.5],[Math.PI/2,0,0]);
      cylinder(root,p.paper,[0,0,.05],[.45,.018,.45],[Math.PI/2,0,0]);
      for(let i=0;i<12;i++)box(root,p.ink,[Math.sin(i*Math.PI/6)*.38,Math.cos(i*Math.PI/6)*.38,.067],[.022,.05,.015],[0,0,-i*Math.PI/6]);
      const hands=group('fixed-hands');root.add(hands);
      const minute=17*Math.PI/30,hour=(11+17/60)*Math.PI/6;
      beam(hands,p.dark,[0,0,.08],[Math.sin(minute)*.32,Math.cos(minute)*.32,.08],.014);
      beam(hands,p.dark,[0,0,.09],[Math.sin(hour)*.22,Math.cos(hour)*.22,.09],.022);
      return end(root,'station-clock',1,.12,1,{hands},[],'wall-center');
    },
    'folding-support'({deployed=false}={}) {
      const root=group('folding-route-support');
      box(root,p.wood,[0,.07,0],[1.1,.14,.72]);
      const legs=[];
      for(const x of [-.42,.42]) { const leg=group(`folding-leg-${x}`);root.add(leg);leg.position.set(x,.14,0);leg.rotation.z=deployed?0:Math.PI*.38;beam(leg,p.brass,[0,0,-.24],[0,.72,.24],.035);beam(leg,p.brass,[0,0,.24],[0,.72,-.24],.035);legs.push(leg); }
      return end(root,'folding-support',1.1,.72,.9,{legs},[physical(1.1,.72,.9)]);
    },
    'platform-bench'() {
      const root=group('station-platform-bench');box(root,p.wood,[0,.52,0],[1.8,.16,.55]);
      for(const x of [-.72,.72]) {box(root,p.brass,[x,.28,0],[.09,.48,.42]);box(root,p.wood,[x,.06,0],[.16,.12,.5]);}
      box(root,p.wood,[0,.91,-.23],[1.8,.65,.1]);
      return end(root,'platform-bench',1.8, .55,.92,{},[physical(1.8,.55,.92)]);
    },
    stroller() {
      const root=group('neighbor-stroller');
      for(const x of [-.34,.34]) {for(const z of [-.4,.4])cylinder(root,p.dark,[x,.16,z],[.15,.09,.15],[0,0,Math.PI/2]);beam(root,p.brass,[x,.16,-.4],[x,.72,.2],.025);beam(root,p.brass,[x,.16,.4],[x,.8,-.2],.025);beam(root,p.brass,[x,.52,-.24],[x,1.1,-.56],.025);}
      beam(root,p.wood,[-.34,1.1,-.56],[.34,1.1,-.56],.035);
      box(root,p.green,[0,.59,0],[.6,.15,.7]);box(root,p.green,[0,.8,-.28],[.6,.4,.1],[.18,0,0]);
      box(root,p.paper,[0,.7,.08],[.48,.08,.4]);
      return end(root,'stroller',.8,1.12,1.14,{},[physical(.8,1.12,1.14)]);
    },
  };
  return factory(builders);
}
