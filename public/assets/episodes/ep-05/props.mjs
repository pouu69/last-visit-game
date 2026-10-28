import { episodeKit } from '../ep-02/model-kit.mjs';
export function createEpisode05Props(core) {
  const {group,box,cylinder,beam,revolve,p,waterPaint,material,label,end,factory,physical,keep}=episodeKit(core,'ep-05');
  return factory({
    'water-basin'({filled=true}={}) {
      const root=group('paper-boat-basin');
      revolve(root,p.plaster,[[0,0],[.54,0],[.65,.08],[.7,.3],[.67,.34],[.62,.3],[.57,.1],[0,.1]]);
      const water=keep(cylinder(root,waterPaint,[0,.24,0],[.63,.009,.63]));water.visible=filled;
      return end(root,'water-basin',1.4,1.4,.34,{water},[physical(1.4,1.4,.34)]);
    },
    'paper-stack'() {
      const root=group('new-paper-stack');
      for(let i=0;i<7;i++)box(root,p.paper,[i*.008,.008+i*.014,0],[.72,.014,.5],[0,i*.015,0]);
      label(root,'다음에 함께 접을 종이',[.03,.11,0],[.6,.4,.012],[-Math.PI/2,0,0]);
      return end(root,'paper-stack',.78,.56,.12,{},[],'support-center');
    },
    shelter() {
      const root=group('upper-rest-shelter');const collision=[];
      for(const x of [-2.4,2.4])for(const z of [-1.6,1.6]) {
        box(root,p.wood,[x,1.5,z],[.18,3,.18]);collision.push(physical(.18,.18,3,x,z));
        beam(root,p.wood,[x,2.7,z],[x*.8,3,z],.06);
      }
      box(root,p.green,[0,3.1,0],[5.4,.2,3.8]);
      for(const z of [-1.7,1.7])box(root,p.wood,[0,2.98,z],[5,.18,.12]);
      for(const x of [-2.4,2.4])box(root,p.wood,[x,2.98,0],[.12,.18,3.4]);
      return end(root,'shelter',5.4,3.8,3.2,{},collision);
    },
    'role-board'() {
      const root=group('return-role-board');
      const face=label(root,'귀환 · 역 뒤뜰\n표지 문정 / 신호 소희 / 조명 이든',[0,.08,0],[1,.7,.02],[-Math.PI/2,0,0]);
      box(root,p.wood,[0,.04,0],[1.04,.06,.74]);
      return end(root,'role-board',1.04,.74,.1,{face},[],'support-center');
    },
    'river-path-fork'() { const root=group('station-to-shelter-path-fork'); const surface=material('#ddd6bd',{roughness:.95}); box(root,surface,[0,.035,0],[4.8,.07,1.5]); box(root,surface,[-1.35,.04,1.15],[2.1,.08,1.1],[0,-.36,0]); box(root,surface,[1.45,.04,1.12],[2.2,.08,1.1],[0,.34,0]); for(const x of [-2.1,2.1])box(root,p.wood,[x,.32,0],[.12,.64,.12]); const cue=label(root,'위쪽 쉼터',[0,.09,-.46],[.8,.3,.015],[-Math.PI/2,0,0]); return end(root,'river-path-fork',5.4,2.5,.64,{cue},[physical(.14,.14,.64,-2.1),physical(.14,.14,.64,2.1)]); },
    'shelter-bench'() { const root=group('bright-shelter-bench');box(root,p.wood,[0,.48,0],[1.7,.14,.5]);for(const x of [-.65,.65]){box(root,p.brass,[x,.24,0],[.08,.46,.38]);box(root,p.wood,[x,.06,0],[.16,.12,.45]);}return end(root,'shelter-bench',1.7,.5,.62,{},[physical(1.7,.5,.62)]); },
  });
}
