import{S as We,i as Ye,s as ze,k as h,q as U,a as V,w as _e,l as u,m as c,r as X,h as n,c as k,x as pe,n as s,b as fe,G as e,y as me,f as y,d as He,t as ae,z as ge,J as ve,u as he,p as de,g as Pe}from"../../../chunks/index-0696beeb.js";import{I as Ge}from"../../../chunks/Intro-eb47d578.js";import{L as Se}from"../../../chunks/Links-a99bb8af.js";function Ae(r,a,o){const i=r.slice();return i[1]=a[o],i}function Le(r,a,o){const i=r.slice();return i[1]=a[o],i}function Me(r,a,o){const i=r.slice();return i[6]=a[o],i[8]=o,i}function Te(r){let a,o,i=r[0].news[r[8]].date+"",p,A,T,H=r[0].news[r[8]].news+"",$;return{c(){a=h("div"),o=h("p"),p=U(i),A=V(),T=h("p"),$=V(),this.h()},l(E){a=u(E,"DIV",{class:!0});var v=c(a);o=u(v,"P",{class:!0});var D=c(o);p=X(D,i),D.forEach(n),A=k(v),T=u(v,"P",{class:!0});var g=c(T);g.forEach(n),$=k(v),v.forEach(n),this.h()},h(){s(o,"class","pure-u-1 pure-u-md-1-5 date"),s(T,"class","item pure-u-1 pure-u-md-4-5"),s(a,"class","news-item pure-g")},m(E,v){fe(E,a,v),e(a,o),e(o,p),e(a,A),e(a,T),T.innerHTML=H,e(a,$)},p(E,v){v&1&&i!==(i=E[0].news[E[8]].date+"")&&he(p,i),v&1&&H!==(H=E[0].news[E[8]].news+"")&&(T.innerHTML=H)},d(E){E&&n(a)}}}function je(r){let a,o,i,p,A,T,H,$,E=r[1].venue+"",v,D,g,L,R,C,N=r[1].title+"",G,J,B,S,F=r[1].authors.map(Ce).join(", ")+"",b,j,P,_;return j=new Se({props:{pub:r[1]}}),{c(){a=h("div"),o=h("div"),i=h("a"),p=h("div"),T=V(),H=h("div"),$=h("p"),v=U(E),D=V(),g=h("div"),L=h("div"),R=h("a"),C=h("h4"),G=U(N),B=V(),S=h("p"),b=V(),_e(j.$$.fragment),P=V(),this.h()},l(d){a=u(d,"DIV",{class:!0});var m=c(a);o=u(m,"DIV",{class:!0});var W=c(o);i=u(W,"A",{href:!0});var Z=c(i);p=u(Z,"DIV",{style:!0,class:!0,alt:!0}),c(p).forEach(n),Z.forEach(n),T=k(W),H=u(W,"DIV",{});var M=c(H);$=u(M,"P",{class:!0});var Y=c($);v=X(Y,E),Y.forEach(n),M.forEach(n),W.forEach(n),D=k(m),g=u(m,"DIV",{class:!0});var z=c(g);L=u(z,"DIV",{class:!0});var O=c(L);R=u(O,"A",{href:!0});var x=c(R);C=u(x,"H4",{class:!0});var le=c(C);G=X(le,N),le.forEach(n),x.forEach(n),B=k(O),S=u(O,"P",{class:!0});var ie=c(S);ie.forEach(n),O.forEach(n),b=k(z),pe(j.$$.fragment,z),z.forEach(n),P=k(m),m.forEach(n),this.h()},h(){de(p,"background-image","url("+("images/"+r[1].teaser)+")"),s(p,"class","thumb"),s(p,"alt","teaser"),s(i,"href",A="/paper/"+r[1].id),s($,"class","venue"),s(o,"class","thumb-box pure-u-1 pure-u-md-1-3 svelte-6075h1"),s(C,"class","paper-title"),s(R,"href",J="/paper/"+r[1].id),s(S,"class","authors"),s(L,"class","padded"),s(g,"class","pure-u-1 pure-u-md-2-3"),s(a,"class","pure-g pub")},m(d,m){fe(d,a,m),e(a,o),e(o,i),e(i,p),e(o,T),e(o,H),e(H,$),e($,v),e(a,D),e(a,g),e(g,L),e(L,R),e(R,C),e(C,G),e(L,B),e(L,S),S.innerHTML=F,e(g,b),me(j,g,null),e(a,P),_=!0},p(d,m){(!_||m&1)&&de(p,"background-image","url("+("images/"+d[1].teaser)+")"),(!_||m&1&&A!==(A="/paper/"+d[1].id))&&s(i,"href",A),(!_||m&1)&&E!==(E=d[1].venue+"")&&he(v,E),(!_||m&1)&&N!==(N=d[1].title+"")&&he(G,N),(!_||m&1&&J!==(J="/paper/"+d[1].id))&&s(R,"href",J),(!_||m&1)&&F!==(F=d[1].authors.map(Ce).join(", ")+"")&&(S.innerHTML=F);const W={};m&1&&(W.pub=d[1]),j.$set(W)},i(d){_||(y(j.$$.fragment,d),_=!0)},o(d){ae(j.$$.fragment,d),_=!1},d(d){d&&n(a),ge(j)}}}function Re(r){let a,o,i,p,A,T,H,$=r[1].venue+"",E,v,D,g,L,R,C=r[1].title+"",N,G,J,B,S=r[1].authors.map(Ne).join(", ")+"",F,b,j,P;return b=new Se({props:{pub:r[1]}}),{c(){a=h("div"),o=h("div"),i=h("a"),p=h("div"),T=V(),H=h("p"),E=U($),v=V(),D=h("div"),g=h("div"),L=h("a"),R=h("h4"),N=U(C),J=V(),B=h("p"),F=V(),_e(b.$$.fragment),j=V(),this.h()},l(_){a=u(_,"DIV",{class:!0});var d=c(a);o=u(d,"DIV",{class:!0});var m=c(o);i=u(m,"A",{href:!0});var W=c(i);p=u(W,"DIV",{style:!0,class:!0,alt:!0}),c(p).forEach(n),W.forEach(n),T=k(m),H=u(m,"P",{class:!0});var Z=c(H);E=X(Z,$),Z.forEach(n),m.forEach(n),v=k(d),D=u(d,"DIV",{class:!0});var M=c(D);g=u(M,"DIV",{class:!0});var Y=c(g);L=u(Y,"A",{href:!0});var z=c(L);R=u(z,"H4",{class:!0});var O=c(R);N=X(O,C),O.forEach(n),z.forEach(n),J=k(Y),B=u(Y,"P",{class:!0});var x=c(B);x.forEach(n),Y.forEach(n),F=k(M),pe(b.$$.fragment,M),M.forEach(n),j=k(d),d.forEach(n),this.h()},h(){de(p,"background-image","url("+("images/"+r[1].teaser)+")"),s(p,"class","thumb"),s(p,"alt","teaser"),s(i,"href",A="/paper/"+r[1].id),s(H,"class","venue"),s(o,"class","thumb-box pure-u-1 pure-u-md-1-3 svelte-6075h1"),s(R,"class","paper-title"),s(L,"href",G="/paper/"+r[1].id),s(B,"class","author"),s(g,"class","padded"),s(D,"class","pure-u-1 pure-u-md-2-3"),s(a,"class","pure-g pub")},m(_,d){fe(_,a,d),e(a,o),e(o,i),e(i,p),e(o,T),e(o,H),e(H,E),e(a,v),e(a,D),e(D,g),e(g,L),e(L,R),e(R,N),e(g,J),e(g,B),B.innerHTML=S,e(D,F),me(b,D,null),e(a,j),P=!0},p(_,d){(!P||d&1)&&de(p,"background-image","url("+("images/"+_[1].teaser)+")"),(!P||d&1&&A!==(A="/paper/"+_[1].id))&&s(i,"href",A),(!P||d&1)&&$!==($=_[1].venue+"")&&he(E,$),(!P||d&1)&&C!==(C=_[1].title+"")&&he(N,C),(!P||d&1&&G!==(G="/paper/"+_[1].id))&&s(L,"href",G),(!P||d&1)&&S!==(S=_[1].authors.map(Ne).join(", ")+"")&&(B.innerHTML=S);const m={};d&1&&(m.pub=_[1]),b.$set(m)},i(_){P||(y(b.$$.fragment,_),P=!0)},o(_){ae(b.$$.fragment,_),P=!1},d(_){_&&n(a),ge(b)}}}function Je(r){let a,o,i,p,A,T,H,$,E,v,D,g,L,R,C,N,G,J,B,S,F,b,j,P,_,d,m,W,Z,M,Y,z,O,x,le,ie,ue;$=new Ge({});let se={length:3},q=[];for(let l=0;l<se.length;l+=1)q[l]=Te(Me(r,se,l));let ee=r[0].pubs,I=[];for(let l=0;l<ee.length;l+=1)I[l]=je(Le(r,ee,l));const qe=l=>ae(I[l],1,1,()=>{I[l]=null});let te=r[0].other,w=[];for(let l=0;l<te.length;l+=1)w[l]=Re(Ae(r,te,l));const Be=l=>ae(w[l],1,1,()=>{w[l]=null});return{c(){a=h("div"),o=h("div"),i=h("h2"),p=U("Hi! You can call me "),A=h("span"),T=U("Alex"),H=V(),_e($.$$.fragment),E=V(),v=h("div"),D=h("div"),g=h("h2"),L=U("News"),R=V(),C=h("p"),N=h("a"),G=U("see all"),J=V(),B=h("hr"),S=V();for(let l=0;l<q.length;l+=1)q[l].c();F=V(),b=h("div"),j=h("div"),P=h("h2"),_=U("Refereed Publications"),d=V(),m=h("hr"),W=V();for(let l=0;l<I.length;l+=1)I[l].c();Z=V(),M=h("div"),Y=h("div"),z=h("h2"),O=U("Workshops, Demos, Posters, and Preprints"),x=V(),le=h("hr"),ie=V();for(let l=0;l<w.length;l+=1)w[l].c();this.h()},l(l){a=u(l,"DIV",{id:!0});var f=c(a);o=u(f,"DIV",{id:!0});var t=c(o);i=u(t,"H2",{class:!0});var K=c(i);p=X(K,"Hi! You can call me "),A=u(K,"SPAN",{class:!0});var Ee=c(A);T=X(Ee,"Alex"),Ee.forEach(n),K.forEach(n),H=k(t),pe($.$$.fragment,t),t.forEach(n),E=k(f),v=u(f,"DIV",{id:!0,class:!0});var re=c(v);D=u(re,"DIV",{class:!0});var ce=c(D);g=u(ce,"H2",{class:!0});var be=c(g);L=X(be,"News"),be.forEach(n),R=k(ce),C=u(ce,"P",{});var $e=c(C);N=u($e,"A",{class:!0,href:!0});var De=c(N);G=X(De,"see all"),De.forEach(n),$e.forEach(n),ce.forEach(n),J=k(re),B=u(re,"HR",{}),S=k(re);for(let Q=0;Q<q.length;Q+=1)q[Q].l(re);re.forEach(n),F=k(f),b=u(f,"DIV",{id:!0,class:!0});var ne=c(b);j=u(ne,"DIV",{class:!0});var Ie=c(j);P=u(Ie,"H2",{class:!0});var we=c(P);_=X(we,"Refereed Publications"),we.forEach(n),Ie.forEach(n),d=k(ne),m=u(ne,"HR",{}),W=k(ne);for(let Q=0;Q<I.length;Q+=1)I[Q].l(ne);ne.forEach(n),Z=k(f),M=u(f,"DIV",{id:!0,class:!0});var oe=c(M);Y=u(oe,"DIV",{class:!0});var Ve=c(Y);z=u(Ve,"H2",{class:!0});var ke=c(z);O=X(ke,"Workshops, Demos, Posters, and Preprints"),ke.forEach(n),Ve.forEach(n),x=k(oe),le=u(oe,"HR",{}),ie=k(oe);for(let Q=0;Q<w.length;Q+=1)w[Q].l(oe);oe.forEach(n),f.forEach(n),this.h()},h(){s(A,"class","name"),s(i,"class","header svelte-6075h1"),s(o,"id","intro"),s(g,"class","header svelte-6075h1"),s(N,"class","right-all"),s(N,"href","/news"),s(D,"class","inline svelte-6075h1"),s(v,"id","news"),s(v,"class","sect"),s(P,"class","header svelte-6075h1"),s(j,"class","inline svelte-6075h1"),s(b,"id","pubs"),s(b,"class","sect"),s(z,"class","header svelte-6075h1"),s(Y,"class","inline svelte-6075h1"),s(M,"id","pubs"),s(M,"class","sect"),s(a,"id","padded-content")},m(l,f){fe(l,a,f),e(a,o),e(o,i),e(i,p),e(i,A),e(A,T),e(o,H),me($,o,null),e(a,E),e(a,v),e(v,D),e(D,g),e(g,L),e(D,R),e(D,C),e(C,N),e(N,G),e(v,J),e(v,B),e(v,S);for(let t=0;t<q.length;t+=1)q[t].m(v,null);e(a,F),e(a,b),e(b,j),e(j,P),e(P,_),e(b,d),e(b,m),e(b,W);for(let t=0;t<I.length;t+=1)I[t].m(b,null);e(a,Z),e(a,M),e(M,Y),e(Y,z),e(z,O),e(M,x),e(M,le),e(M,ie);for(let t=0;t<w.length;t+=1)w[t].m(M,null);ue=!0},p(l,[f]){if(f&1){se={length:3};let t;for(t=0;t<se.length;t+=1){const K=Me(l,se,t);q[t]?q[t].p(K,f):(q[t]=Te(K),q[t].c(),q[t].m(v,null))}for(;t<q.length;t+=1)q[t].d(1);q.length=se.length}if(f&1){ee=l[0].pubs;let t;for(t=0;t<ee.length;t+=1){const K=Le(l,ee,t);I[t]?(I[t].p(K,f),y(I[t],1)):(I[t]=je(K),I[t].c(),y(I[t],1),I[t].m(b,null))}for(Pe(),t=ee.length;t<I.length;t+=1)qe(t);He()}if(f&1){te=l[0].other;let t;for(t=0;t<te.length;t+=1){const K=Ae(l,te,t);w[t]?(w[t].p(K,f),y(w[t],1)):(w[t]=Re(K),w[t].c(),y(w[t],1),w[t].m(M,null))}for(Pe(),t=te.length;t<w.length;t+=1)Be(t);He()}},i(l){if(!ue){y($.$$.fragment,l);for(let f=0;f<ee.length;f+=1)y(I[f]);for(let f=0;f<te.length;f+=1)y(w[f]);ue=!0}},o(l){ae($.$$.fragment,l),I=I.filter(Boolean);for(let f=0;f<I.length;f+=1)ae(I[f]);w=w.filter(Boolean);for(let f=0;f<w.length;f+=1)ae(w[f]);ue=!1},d(l){l&&n(a),ge($),ve(q,l),ve(I,l),ve(w,l)}}}const Ce=r=>`<a class='${r.name.includes("\xC1ngel Alexander Cabrera")?"me":""} author' href='${r.website?r.website:"javascript:void(0);"}'>${r.name}</a>`,Ne=r=>`<a class='${r.name==="\xC1ngel Alexander Cabrera"?"me":""} author' href='${r.website}'>${r.name}</a>`;function Fe(r,a,o){let{data:i}=a;return r.$$set=p=>{"data"in p&&o(0,i=p.data)},[i]}class Ue extends We{constructor(a){super(),Ye(this,a,Fe,Je,ze,{data:0})}}export{Ue as default};
