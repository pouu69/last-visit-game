import { episodeKit } from '../ep-02/model-kit.mjs';
export function createEpisode03Props(core) {
  const {group,box,cylinder,beam,ring,p,material,label,end,factory,physical,keep}=episodeKit(core,'ep-03');
  const cloth=material('#856258',{roughness:.95});
  return factory({
    chair() {
      const root=group('movable-chair');
      for(const x of [-.26,.26])for(const z of [-.25,.25])box(root,p.wood,[x,.25,z],[.065,.5,.065]);
      box(root,cloth,[0,.51,0],[.62,.1,.62]);
      for(const x of [-.26,.26])box(root,p.wood,[x,.8,-.27],[.065,.65,.065]);
      box(root,cloth,[0,.99,-.27],[.62,.3,.08]);
      return end(root,'chair',.62,.62,1.14,{},[physical(.62,.62,1.14)]);
    },
    microphone() {
      const root=group('microphone-stand');
      cylinder(root,p.dark,[0,.04,0],[.33,.07,.33]);cylinder(root,p.brass,[0,.7,0],[.023,1.3,.023]);
      beam(root,p.dark,[0,1.35,0],[.35,1.5,.05],.023);
      cylinder(root,p.dark,[.39,1.51,.05],[.05,.22,.05],[0,0,-Math.PI/2]);
      const head=cylinder(root,p.edge,[.51,1.51,.05],[.06,.05,.06],[0,0,-Math.PI/2]);
      for(let i=0;i<4;i++)ring(root,p.ink,[.5+i*.009,1.51,.05],.056,.003,[0,Math.PI/2,0]);
      return end(root,'microphone',.88,.66,1.58,{head:keep(head)},[physical(.66,.66,.1)]);
    },
    'track-console'() {
      const root=group('track-comparison');
      box(root,p.wood,[0,.45,0],[1.6,.9,.72]);
      box(root,p.dark,[0,1.24,-.08],[1.3,.7,.14]);
      const screen=label(root,'녹음 02:00 · 시작 박수 ━━━━━\n제거한 독창 02:30~02:46 ━  ━━\n다음 모임용 편집',[0,1.24,.001],[1.18,.59,.012]);
      for(let i=0;i<5;i++)cylinder(root,i===0?p.rust:p.brass,[-.55+i*.27,.94,.19],[.045,.03,.045]);
      return end(root,'track-console',1.6,.72,1.6,{screen},[physical(1.6,.72,.9)]);
    },
    'signal-cards'({signal='잠시 멈춤'}={}) {
      const root=group('visual-signal-cards');
      const cards=[];
      ['1','2','3','4',signal].forEach((text,i)=> {
        const card=group(`signal-card-${i+1}`);root.add(card);card.position.set((i-2)*.22,.03+i*.018,0);card.rotation.y=(i-2)*.1;
        label(card,text,[0,0,0],[.38,.5,.018],[-Math.PI/2,0,0]);cards.push(card);
      });
      return end(root,'signal-cards',1.35,.6,.14,{cards},[],'support-center');
    },
    'score-notes'() {
      const root=group('score-and-timeline');
      label(root,'楽譜 · 원래 대기\n녹음 02:10~02:26',[ -.3,.025,0],[.75,.58,.018],[-Math.PI/2,0,0]);
      label(root,'편집 메모 · 독창 트랙 제거\n녹음 02:30~02:46',[.4,.04,.05],[.6,.5,.018],[-Math.PI/2,0,.08]);
      return end(root,'score-notes',1.45,.66,.06,{},[],'support-center');
    },
    'personal-player'() {
      const root=group('jeongyeon-private-player');box(root,p.dark,[0,.06,0],[.24,.12,.4]);
      const screen=label(root,'개인 청취',[0,.126,-.06],[.19,.16,.012],[-Math.PI/2,0,0]);
      cylinder(root,p.brass,[0,.125,.11],[.035,.012,.035]);
      ring(root,p.dark,[.22,.03,0],.12,.012,[-Math.PI/2,0,0]);
      return end(root,'personal-player',.6,.4,.14,{screen},[],'support-center');
    },
    'timing-board'() { const root=group('two-minute-comparison-clock'); box(root,p.wood,[0,.5,0],[1.4,1,.16]); const clap=label(root,'시작 박수 · 녹음 02:00',[0,.68,.09],[1.1,.28,.02]); const video=label(root,'같은 박수 · 영상 00:00',[0,.35,.09],[1.1,.28,.02]); return end(root,'timing-board',1.4,.16,1,{clap,video},[physical(1.4,.16,1)]); },
    'open-circle'() { const root=group('open-audience-circle'); const chairs=[],colliders=[]; const angles=[-135,-90,-45,45,90,135].map(x=>x*Math.PI/180); for(let i=0;i<angles.length;i++){const a=angles[i],x=Math.sin(a)*1.45,z=Math.cos(a)*1.45;const seat=group(`chair-${i}`);root.add(seat);seat.position.set(x,0,z);seat.rotation.y=a+Math.PI;box(seat,p.wood,[0,.46,0],[.58,.1,.58]);for(const lx of [-.23,.23])for(const lz of [-.22,.22])box(seat,p.wood,[lx,.23,lz],[.055,.46,.055]);box(seat,p.wood,[0,.78,-.24],[.58,.52,.07]);chairs.push(seat);colliders.push(physical(.82,.82,1.05,x,z));} return end(root,'open-circle',3.65,3.15,1.05,{chairs},colliders); },
  });
}
