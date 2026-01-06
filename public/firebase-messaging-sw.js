(()=>{var p=(e,t)=>()=>(e&&(t=e(e=0)),t);var jt=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Le,Pe=p(()=>{Le=()=>{}});function Ut(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}function P(){try{return typeof indexedDB=="object"}catch{return!1}}function F(){return new Promise((e,t)=>{try{let n=!0,r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{var o;t(((o=i.error)===null||o===void 0?void 0:o.message)||"")}}catch(n){t(n)}})}function Jt(e,t){return e.replace(Yt,(n,r)=>{let i=t[r];return i!=null?String(i):`<${r}?>`})}function $(e,t){if(e===t)return!0;let n=Object.keys(e),r=Object.keys(t);for(let i of n){if(!r.includes(i))return!1;let o=e[i],s=t[i];if(Fe(o)&&Fe(s)){if(!$(o,s))return!1}else if(o!==s)return!1}for(let i of r)if(!n.includes(i))return!1;return!0}function Fe(e){return e!==null&&typeof e=="object"}function te(e){return e&&e._delegate?e._delegate:e}var $e,Ht,je,Q,Vt,X,He,Wt,zt,Kt,qt,ee,L,Gt,m,b,Yt,Ri,k=p(()=>{Pe();$e=function(e){let t=[],n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},Ht=function(e){let t=[],n=0,r=0;for(;n<e.length;){let i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){let o=e[n++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){let o=e[n++],s=e[n++],a=e[n++],c=((i&7)<<18|(o&63)<<12|(s&63)<<6|a&63)-65536;t[r++]=String.fromCharCode(55296+(c>>10)),t[r++]=String.fromCharCode(56320+(c&1023))}else{let o=e[n++],s=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|s&63)}}return t.join("")},je={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<e.length;i+=3){let o=e[i],s=i+1<e.length,a=s?e[i+1]:0,c=i+2<e.length,l=c?e[i+2]:0,u=o>>2,O=(o&3)<<4|a>>4,B=(a&15)<<2|l>>6,R=l&63;c||(R=64,s||(B=64)),r.push(n[u],n[O],n[B],n[R])}return r.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray($e(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):Ht(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<e.length;){let o=n[e.charAt(i++)],a=i<e.length?n[e.charAt(i)]:0;++i;let l=i<e.length?n[e.charAt(i)]:64;++i;let O=i<e.length?n[e.charAt(i)]:64;if(++i,o==null||a==null||l==null||O==null)throw new Q;let B=o<<2|a>>4;if(r.push(B),l!==64){let R=a<<4&240|l>>2;if(r.push(R),O!==64){let $t=l<<6&192|O;r.push($t)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}},Q=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},Vt=function(e){let t=$e(e);return je.encodeByteArray(t,!0)},X=function(e){return Vt(e).replace(/\./g,"")},He=function(e){try{return je.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};Wt=()=>Ut().__FIREBASE_DEFAULTS__,zt=()=>{if(typeof process>"u"||typeof process.env>"u")return;let e=process.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Kt=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&He(e[1]);return t&&JSON.parse(t)},qt=()=>{try{return Le()||Wt()||zt()||Kt()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}},ee=()=>{var e;return(e=qt())===null||e===void 0?void 0:e.config};L=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,r))}}};Gt="FirebaseError",m=class e extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=Gt,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,b.prototype.create)}},b=class{constructor(t,n,r){this.service=t,this.serviceName=n,this.errors=r}create(t,...n){let r=n[0]||{},i=`${this.service}/${t}`,o=this.errors[t],s=o?Jt(o,r):"Error",a=`${this.serviceName}: ${s} (${i}).`;return new m(i,a,r)}};Yt=/\{\$([^}]+)}/g;Ri=14400*1e3;});function Zt(e){return e===I?void 0:e}function Qt(e){return e.instantiationMode==="EAGER"}var d,I,ne,j,H=p(()=>{k();d=class{constructor(t,n,r){this.name=t,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}};I="[DEFAULT]";ne=class{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){let n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){let r=new L;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{let i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){var n;let r=this.normalizeInstanceIdentifier(t?.identifier),i=(n=t?.optional)!==null&&n!==void 0?n:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(o){if(i)return null;throw o}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Qt(t))try{this.getOrInitializeService({instanceIdentifier:I})}catch{}for(let[n,r]of this.instancesDeferred.entries()){let i=this.normalizeInstanceIdentifier(n);try{let o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=I){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){let t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=I){return this.instances.has(t)}getOptions(t=I){return this.instancesOptions.get(t)||{}}initialize(t={}){let{options:n={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(let[o,s]of this.instancesDeferred.entries()){let a=this.normalizeInstanceIdentifier(o);r===a&&s.resolve(i)}return i}onInit(t,n){var r;let i=this.normalizeInstanceIdentifier(n),o=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;o.add(t),this.onInitCallbacks.set(i,o);let s=this.instances.get(i);return s&&t(s,i),()=>{o.delete(t)}}invokeOnInitCallbacks(t,n){let r=this.onInitCallbacks.get(n);if(r)for(let i of r)try{i(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Zt(t),options:n}),this.instances.set(t,r),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=I){return this.component?this.component.multipleInstances?t:I:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};j=class{constructor(t){this.name=t,this.providers=new Map}addComponent(t){let n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);let n=new ne(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}}});var Xt,f,en,tn,nn,rn,V,Ve=p(()=>{Xt=[];(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));en={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},tn=f.INFO,nn={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},rn=(e,t,...n)=>{if(t<e.logLevel)return;let r=new Date().toISOString(),i=nn[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)},V=class{constructor(t){this.name=t,this._logLevel=tn,this._logHandler=rn,this._userLogHandler=null,Xt.push(this)}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?en[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}}});function sn(){return Ue||(Ue=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function an(){return We||(We=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}function cn(e){let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("success",o),e.removeEventListener("error",s)},o=()=>{n(g(e.result)),i()},s=()=>{r(e.error),i()};e.addEventListener("success",o),e.addEventListener("error",s)});return t.then(n=>{n instanceof IDBCursor&&ze.set(n,e)}).catch(()=>{}),se.set(t,e),t}function un(e){if(ie.has(e))return;let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",s),e.removeEventListener("abort",s)},o=()=>{n(),i()},s=()=>{r(e.error||new DOMException("AbortError","AbortError")),i()};e.addEventListener("complete",o),e.addEventListener("error",s),e.addEventListener("abort",s)});ie.set(e,t)}function qe(e){oe=e(oe)}function ln(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){let r=e.call(U(this),t,...n);return Ke.set(r,t.sort?t.sort():[t]),g(r)}:an().includes(e)?function(...t){return e.apply(U(this),t),g(ze.get(this))}:function(...t){return g(e.apply(U(this),t))}}function fn(e){return typeof e=="function"?ln(e):(e instanceof IDBTransaction&&un(e),on(e,sn())?new Proxy(e,oe):e)}function g(e){if(e instanceof IDBRequest)return cn(e);if(re.has(e))return re.get(e);let t=fn(e);return t!==e&&(re.set(e,t),se.set(t,e)),t}var on,Ue,We,ze,ie,Ke,re,se,oe,U,ae=p(()=>{on=(e,t)=>t.some(n=>e instanceof n);ze=new WeakMap,ie=new WeakMap,Ke=new WeakMap,re=new WeakMap,se=new WeakMap;oe={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return ie.get(e);if(t==="objectStoreNames")return e.objectStoreNames||Ke.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return g(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};U=e=>se.get(e)});function S(e,t,{blocked:n,upgrade:r,blocking:i,terminated:o}={}){let s=indexedDB.open(e,t),a=g(s);return r&&s.addEventListener("upgradeneeded",c=>{r(g(s.result),c.oldVersion,c.newVersion,g(s.transaction),c)}),n&&s.addEventListener("blocked",c=>n(c.oldVersion,c.newVersion,c)),a.then(c=>{o&&c.addEventListener("close",()=>o()),i&&c.addEventListener("versionchange",l=>i(l.oldVersion,l.newVersion,l))}).catch(()=>{}),a}function W(e,{blocked:t}={}){let n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",r=>t(r.oldVersion,r)),g(n).then(()=>{})}function Ge(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(ce.get(t))return ce.get(t);let n=t.replace(/FromIndex$/,""),r=t!==n,i=hn.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||dn.includes(n)))return;let o=async function(s,...a){let c=this.transaction(s,i?"readwrite":"readonly"),l=c.store;return r&&(l=l.index(a.shift())),(await Promise.all([l[n](...a),i&&c.done]))[0]};return ce.set(t,o),o}var dn,hn,ce,z=p(()=>{ae();ae();dn=["get","getKey","getAll","getAllKeys","count"],hn=["put","add","delete","clear"],ce=new Map;qe(e=>({...e,get:(t,n,r)=>Ge(t,n)||e.get(t,n,r),has:(t,n)=>!!Ge(t,n)||e.has(t,n)}))});function pn(e){let t=e.getComponent();return t?.type==="VERSION"}function Ye(e,t){try{e.container.addComponent(t)}catch(n){w.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function E(e){let t=e.name;if(he.has(t))return w.debug(`There were multiple attempts to register component ${t}.`),!1;he.set(t,e);for(let n of K.values())Ye(n,e);for(let n of Vn.values())Ye(n,e);return!0}function N(e,t){let n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}function be(e,t={}){let n=e;typeof t!="object"&&(t={name:t});let r=Object.assign({name:de,automaticDataCollectionEnabled:!0},t),i=r.name;if(typeof i!="string"||!i)throw _.create("bad-app-name",{appName:String(i)});if(n||(n=ee()),!n)throw _.create("no-options");let o=K.get(i);if(o){if($(n,o.options)&&$(r,o.config))return o;throw _.create("duplicate-app",{appName:i})}let s=new j(i);for(let c of he.values())s.addComponent(c);let a=new pe(n,r,s);return K.set(i,a),a}function we(e=de){let t=K.get(e);if(!t&&e===de&&ee())return be();if(!t)throw _.create("no-app",{appName:e});return t}function v(e,t,n){var r;let i=(r=Hn[e])!==null&&r!==void 0?r:e;n&&(i+=`-${n}`);let o=i.match(/\s|\//),s=t.match(/\s|\//);if(o||s){let a=[`Unable to register library "${i}" with version "${t}":`];o&&a.push(`library name "${i}" contains illegal characters (whitespace or "/")`),o&&s&&a.push("and"),s&&a.push(`version name "${t}" contains illegal characters (whitespace or "/")`),w.warn(a.join(" "));return}E(new d(`${i}-version`,()=>({library:i,version:t}),"VERSION"))}function et(){return ue||(ue=S(Wn,zn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(x)}catch(n){console.warn(n)}}}}).catch(e=>{throw _.create("idb-open",{originalErrorMessage:e.message})})),ue}async function Kn(e){try{let n=(await et()).transaction(x),r=await n.objectStore(x).get(tt(e));return await n.done,r}catch(t){if(t instanceof m)w.warn(t.message);else{let n=_.create("idb-get",{originalErrorMessage:t?.message});w.warn(n.message)}}}async function Ze(e,t){try{let r=(await et()).transaction(x,"readwrite");await r.objectStore(x).put(t,tt(e)),await r.done}catch(n){if(n instanceof m)w.warn(n.message);else{let r=_.create("idb-set",{originalErrorMessage:n?.message});w.warn(r.message)}}}function tt(e){return`${e.name}!${e.options.appId}`}function Qe(){return new Date().toISOString().substring(0,10)}function Jn(e,t=qn){let n=[],r=e.slice();for(let i of e){let o=n.find(s=>s.agent===i.agent);if(o){if(o.dates.push(i.date),Xe(n)>t){o.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),Xe(n)>t){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}function Xe(e){return X(JSON.stringify({version:2,heartbeats:e})).length}function Yn(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}function Zn(e){E(new d("platform-logger",t=>new le(t),"PRIVATE")),E(new d("heartbeat",t=>new ge(t),"PRIVATE")),v(fe,Je,e),v(fe,Je,"esm2017"),v("fire-js","")}var le,fe,Je,w,gn,mn,bn,wn,yn,_n,vn,En,In,Sn,Cn,An,Dn,Tn,kn,On,xn,Nn,Mn,Bn,Rn,Ln,Pn,Fn,$n,jn,de,Hn,K,Vn,he,Un,_,pe,Wn,zn,x,ue,qn,Gn,ge,me,M=p(()=>{H();Ve();k();k();z();le=class{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(pn(n)){let r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}};fe="@firebase/app",Je="0.13.2";w=new V("@firebase/app"),gn="@firebase/app-compat",mn="@firebase/analytics-compat",bn="@firebase/analytics",wn="@firebase/app-check-compat",yn="@firebase/app-check",_n="@firebase/auth",vn="@firebase/auth-compat",En="@firebase/database",In="@firebase/data-connect",Sn="@firebase/database-compat",Cn="@firebase/functions",An="@firebase/functions-compat",Dn="@firebase/installations",Tn="@firebase/installations-compat",kn="@firebase/messaging",On="@firebase/messaging-compat",xn="@firebase/performance",Nn="@firebase/performance-compat",Mn="@firebase/remote-config",Bn="@firebase/remote-config-compat",Rn="@firebase/storage",Ln="@firebase/storage-compat",Pn="@firebase/firestore",Fn="@firebase/ai",$n="@firebase/firestore-compat",jn="firebase";de="[DEFAULT]",Hn={[fe]:"fire-core",[gn]:"fire-core-compat",[bn]:"fire-analytics",[mn]:"fire-analytics-compat",[yn]:"fire-app-check",[wn]:"fire-app-check-compat",[_n]:"fire-auth",[vn]:"fire-auth-compat",[En]:"fire-rtdb",[In]:"fire-data-connect",[Sn]:"fire-rtdb-compat",[Cn]:"fire-fn",[An]:"fire-fn-compat",[Dn]:"fire-iid",[Tn]:"fire-iid-compat",[kn]:"fire-fcm",[On]:"fire-fcm-compat",[xn]:"fire-perf",[Nn]:"fire-perf-compat",[Mn]:"fire-rc",[Bn]:"fire-rc-compat",[Rn]:"fire-gcs",[Ln]:"fire-gcs-compat",[Pn]:"fire-fst",[$n]:"fire-fst-compat",[Fn]:"fire-vertex","fire-js":"fire-js",[jn]:"fire-js-all"};K=new Map,Vn=new Map,he=new Map;Un={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},_=new b("app","Firebase",Un);pe=class{constructor(t,n,r){this._isDeleted=!1,this._options=Object.assign({},t),this._config=Object.assign({},n),this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new d("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw _.create("app-deleted",{appName:this._name})}};Wn="firebase-heartbeat-database",zn=1,x="firebase-heartbeat-store",ue=null;qn=1024,Gn=30,ge=class{constructor(t){this.container=t,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new me(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var t,n;try{let i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=Qe();if(((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)===null||n===void 0?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(s=>s.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats.length>Gn){let s=Yn(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(s,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){w.warn(r)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";let n=Qe(),{heartbeatsToSend:r,unsentEntries:i}=Jn(this._heartbeatsCache.heartbeats),o=X(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(n){return w.warn(n),""}}};me=class{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return P()?F().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await Kn(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){var n;if(await this._canUseIndexedDBPromise){let i=await this.read();return Ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:i.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){var n;if(await this._canUseIndexedDBPromise){let i=await this.read();return Ze(this.app,{lastSentHeartbeatDate:(n=t.lastSentHeartbeatDate)!==null&&n!==void 0?n:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...t.heartbeats]})}else return}};Zn("")});var Qn,Xn,nt=p(()=>{M();M();Qn="firebase",Xn="11.10.0";v(Qn,Xn,"app")});function ut(e){return e instanceof m&&e.code.includes("request-failed")}function lt({projectId:e}){return`${er}/projects/${e}/installations`}function ft(e){return{token:e.token,requestStatus:2,expiresIn:sr(e.expiresIn),creationTime:Date.now()}}async function dt(e,t){let r=(await t.json()).error;return A.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function ht({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function or(e,{refreshToken:t}){let n=ht(e);return n.append("Authorization",ar(t)),n}async function pt(e){let t=await e();return t.status>=500&&t.status<600?e():t}function sr(e){return Number(e.replace("s","000"))}function ar(e){return`${ct} ${e}`}async function cr({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let r=lt(e),i=ht(e),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}let s={fid:n,authVersion:ct,appId:e.appId,sdkVersion:at},a={method:"POST",headers:i,body:JSON.stringify(s)},c=await pt(()=>fetch(r,a));if(c.ok){let l=await c.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:ft(l.authToken)}}else throw await dt("Create Installation",c)}function gt(e){return new Promise(t=>{setTimeout(t,e)})}function ur(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}function fr(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=dr(e);return lr.test(n)?n:ve}catch{return ve}}function dr(e){return ur(e).substr(0,22)}function G(e){return`${e.appName}!${e.appId}`}function bt(e,t){let n=G(e);wt(n,t),hr(n,t)}function wt(e,t){let n=mt.get(e);if(n)for(let r of n)r(t)}function hr(e,t){let n=pr();n&&n.postMessage({key:e,fid:t}),gr()}function pr(){return!C&&"BroadcastChannel"in self&&(C=new BroadcastChannel("[Firebase] FID Change"),C.onmessage=e=>{wt(e.data.key,e.data.fid)}),C}function gr(){mt.size===0&&C&&(C.close(),C=null)}function Ie(){return ye||(ye=S(mr,br,{upgrade:(e,t)=>{t===0&&e.createObjectStore(D)}})),ye}async function q(e,t){let n=G(e),i=(await Ie()).transaction(D,"readwrite"),o=i.objectStore(D),s=await o.get(n);return await o.put(t,n),await i.done,(!s||s.fid!==t.fid)&&bt(e,t.fid),t}async function yt(e){let t=G(e),r=(await Ie()).transaction(D,"readwrite");await r.objectStore(D).delete(t),await r.done}async function J(e,t){let n=G(e),i=(await Ie()).transaction(D,"readwrite"),o=i.objectStore(D),s=await o.get(n),a=t(s);return a===void 0?await o.delete(n):await o.put(a,n),await i.done,a&&(!s||s.fid!==a.fid)&&bt(e,a.fid),a}async function Se(e){let t,n=await J(e.appConfig,r=>{let i=wr(r),o=yr(e,i);return t=o.registrationPromise,o.installationEntry});return n.fid===ve?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function wr(e){let t=e||{fid:fr(),registrationStatus:0};return _t(t)}function yr(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let i=Promise.reject(A.create("app-offline"));return{installationEntry:t,registrationPromise:i}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=_r(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:vr(e)}:{installationEntry:t}}async function _r(e,t){try{let n=await cr(e,t);return q(e.appConfig,n)}catch(n){throw ut(n)&&n.customData.serverCode===409?await yt(e.appConfig):await q(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function vr(e){let t=await rt(e.appConfig);for(;t.registrationStatus===1;)await gt(100),t=await rt(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:r}=await Se(e);return r||n}return t}function rt(e){return J(e,t=>{if(!t)throw A.create("installation-not-found");return _t(t)})}function _t(e){return Er(e)?{fid:e.fid,registrationStatus:0}:e}function Er(e){return e.registrationStatus===1&&e.registrationTime+st<Date.now()}async function Ir({appConfig:e,heartbeatServiceProvider:t},n){let r=Sr(e,n),i=or(e,n),o=t.getImmediate({optional:!0});if(o){let l=await o.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}let s={installation:{sdkVersion:at,appId:e.appId}},a={method:"POST",headers:i,body:JSON.stringify(s)},c=await pt(()=>fetch(r,a));if(c.ok){let l=await c.json();return ft(l)}else throw await dt("Generate Auth Token",c)}function Sr(e,{fid:t}){return`${lt(e)}/${t}/authTokens:generate`}async function Ce(e,t=!1){let n,r=await J(e.appConfig,o=>{if(!vt(o))throw A.create("not-registered");let s=o.authToken;if(!t&&Dr(s))return o;if(s.requestStatus===1)return n=Cr(e,t),o;{if(!navigator.onLine)throw A.create("app-offline");let a=kr(o);return n=Ar(e,a),a}});return n?await n:r.authToken}async function Cr(e,t){let n=await it(e.appConfig);for(;n.authToken.requestStatus===1;)await gt(100),n=await it(e.appConfig);let r=n.authToken;return r.requestStatus===0?Ce(e,t):r}function it(e){return J(e,t=>{if(!vt(t))throw A.create("not-registered");let n=t.authToken;return Or(n)?Object.assign(Object.assign({},t),{authToken:{requestStatus:0}}):t})}async function Ar(e,t){try{let n=await Ir(e,t),r=Object.assign(Object.assign({},t),{authToken:n});return await q(e.appConfig,r),n}catch(n){if(ut(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await yt(e.appConfig);else{let r=Object.assign(Object.assign({},t),{authToken:{requestStatus:0}});await q(e.appConfig,r)}throw n}}function vt(e){return e!==void 0&&e.registrationStatus===2}function Dr(e){return e.requestStatus===2&&!Tr(e)}function Tr(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+tr}function kr(e){let t={requestStatus:1,requestTime:Date.now()};return Object.assign(Object.assign({},e),{authToken:t})}function Or(e){return e.requestStatus===1&&e.requestTime+st<Date.now()}async function xr(e){let t=e,{installationEntry:n,registrationPromise:r}=await Se(t);return r?r.catch(console.error):Ce(t).catch(console.error),n.fid}async function Nr(e,t=!1){let n=e;return await Mr(n),(await Ce(n,t)).token}async function Mr(e){let{registrationPromise:t}=await Se(e);t&&await t}function Br(e){if(!e||!e.options)throw _e("App Configuration");if(!e.name)throw _e("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw _e(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function _e(e){return A.create("missing-app-config-values",{valueName:e})}function Fr(){E(new d(Et,Lr,"PUBLIC")),E(new d(Rr,Pr,"PRIVATE"))}var ot,Ee,st,at,ct,er,tr,nr,rr,ir,A,lr,ve,mt,C,mr,br,D,ye,Et,Rr,Lr,Pr,It=p(()=>{M();H();k();z();ot="@firebase/installations",Ee="0.6.18";st=1e4,at=`w:${Ee}`,ct="FIS_v2",er="https://firebaseinstallations.googleapis.com/v1",tr=3600*1e3,nr="installations",rr="Installations";ir={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},A=new b(nr,rr,ir);lr=/^[cdef][\w-]{21}$/,ve="";mt=new Map;C=null;mr="firebase-installations-database",br=1,D="firebase-installations-store",ye=null;Et="installations",Rr="installations-internal",Lr=e=>{let t=e.getProvider("app").getImmediate(),n=Br(t),r=N(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Pr=e=>{let t=e.getProvider("app").getImmediate(),n=N(t,Et).getImmediate();return{getId:()=>xr(n),getToken:i=>Nr(n,i)}};Fr();v(ot,Ee);v(ot,Ee,"esm2017")});function y(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Ur(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),i=new Uint8Array(r.length);for(let o=0;o<r.length;++o)i[o]=r.charCodeAt(o);return i}async function zr(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(Ae))return null;let t=null;return(await S(Ae,Wr,{upgrade:async(r,i,o,s)=>{var a;if(i<2||!r.objectStoreNames.contains(St))return;let c=s.objectStore(St),l=await c.index("fcmSenderId").get(e);if(await c.clear(),!!l){if(i===2){let u=l;if(!u.auth||!u.p256dh||!u.endpoint)return;t={token:u.fcmToken,createTime:(a=u.createTime)!==null&&a!==void 0?a:Date.now(),subscriptionOptions:{auth:u.auth,p256dh:u.p256dh,endpoint:u.endpoint,swScope:u.swScope,vapidKey:typeof u.vapidKey=="string"?u.vapidKey:y(u.vapidKey)}}}else if(i===3){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:y(u.auth),p256dh:y(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:y(u.vapidKey)}}}else if(i===4){let u=l;t={token:u.fcmToken,createTime:u.createTime,subscriptionOptions:{auth:y(u.auth),p256dh:y(u.p256dh),endpoint:u.endpoint,swScope:u.swScope,vapidKey:y(u.vapidKey)}}}}}})).close(),await W(Ae),await W("fcm_vapid_details_db"),await W("undefined"),Kr(t)?t:null}function Kr(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}function Oe(){return De||(De=S(qr,Gr,{upgrade:(e,t)=>{t===0&&e.createObjectStore(T)}})),De}async function xe(e){let t=Me(e),r=await(await Oe()).transaction(T).objectStore(T).get(t);if(r)return r;{let i=await zr(e.appConfig.senderId);if(i)return await Ne(e,i),i}}async function Ne(e,t){let n=Me(e),i=(await Oe()).transaction(T,"readwrite");return await i.objectStore(T).put(t,n),await i.done,t}async function Jr(e){let t=Me(e),r=(await Oe()).transaction(T,"readwrite");await r.objectStore(T).delete(t),await r.done}function Me({appConfig:e}){return e.appId}async function Zr(e,t){let n=await Re(e),r=Ot(t),i={method:"POST",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(Be(e.appConfig),i)).json()}catch(s){throw h.create("token-subscribe-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw h.create("token-subscribe-failed",{errorInfo:s})}if(!o.token)throw h.create("token-subscribe-no-token");return o.token}async function Qr(e,t){let n=await Re(e),r=Ot(t.subscriptionOptions),i={method:"PATCH",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(`${Be(e.appConfig)}/${t.token}`,i)).json()}catch(s){throw h.create("token-update-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw h.create("token-update-failed",{errorInfo:s})}if(!o.token)throw h.create("token-update-no-token");return o.token}async function kt(e,t){let r={method:"DELETE",headers:await Re(e)};try{let o=await(await fetch(`${Be(e.appConfig)}/${t}`,r)).json();if(o.error){let s=o.error.message;throw h.create("token-unsubscribe-failed",{errorInfo:s})}}catch(i){throw h.create("token-unsubscribe-failed",{errorInfo:i?.toString()})}}function Be({projectId:e}){return`${$r}/projects/${e}/registrations`}async function Re({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Ot({p256dh:e,auth:t,endpoint:n,vapidKey:r}){let i={web:{endpoint:n,auth:t,p256dh:e}};return r!==Dt&&(i.web.applicationPubKey=r),i}async function ei(e){let t=await ni(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:y(t.getKey("auth")),p256dh:y(t.getKey("p256dh"))},r=await xe(e.firebaseDependencies);if(r){if(ri(r.subscriptionOptions,n))return Date.now()>=r.createTime+Xr?ti(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await kt(e.firebaseDependencies,r.token)}catch(i){console.warn(i)}return At(e.firebaseDependencies,n)}else return At(e.firebaseDependencies,n)}async function Ct(e){let t=await xe(e.firebaseDependencies);t&&(await kt(e.firebaseDependencies,t.token),await Jr(e.firebaseDependencies));let n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function ti(e,t){try{let n=await Qr(e.firebaseDependencies,t),r=Object.assign(Object.assign({},t),{token:n,createTime:Date.now()});return await Ne(e.firebaseDependencies,r),n}catch(n){throw n}}async function At(e,t){let r={token:await Zr(e,t),createTime:Date.now(),subscriptionOptions:t};return await Ne(e,r),r.token}async function ni(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Ur(t)})}function ri(e,t){let n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,i=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&r&&i&&o}function ii(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return oi(t,e),si(t,e),ai(t,e),t}function oi(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let r=t.notification.body;r&&(e.notification.body=r);let i=t.notification.image;i&&(e.notification.image=i);let o=t.notification.icon;o&&(e.notification.icon=o)}function si(e,t){t.data&&(e.data=t.data)}function ai(e,t){var n,r,i,o,s;if(!t.fcmOptions&&!(!((n=t.notification)===null||n===void 0)&&n.click_action))return;e.fcmOptions={};let a=(i=(r=t.fcmOptions)===null||r===void 0?void 0:r.link)!==null&&i!==void 0?i:(o=t.notification)===null||o===void 0?void 0:o.click_action;a&&(e.fcmOptions.link=a);let c=(s=t.fcmOptions)===null||s===void 0?void 0:s.analytics_label;c&&(e.fcmOptions.analyticsLabel=c)}function ci(e){return typeof e=="object"&&!!e&&jr in e}function ui(e){return new Promise(t=>{setTimeout(t,e)})}async function li(e,t){let n=fi(t,await e.firebaseDependencies.installations.getId());di(e,n,t.productId)}function fi(e,t){var n,r;let i={};return e.from&&(i.project_number=e.from),e.fcmMessageId&&(i.message_id=e.fcmMessageId),i.instance_id=t,e.notification?i.message_type=Y.DISPLAY_NOTIFICATION.toString():i.message_type=Y.DATA_MESSAGE.toString(),i.sdk_platform=Hr.toString(),i.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),e.collapse_key&&(i.collapse_key=e.collapse_key),i.event=Vr.toString(),!((n=e.fcmOptions)===null||n===void 0)&&n.analytics_label&&(i.analytics_label=(r=e.fcmOptions)===null||r===void 0?void 0:r.analytics_label),i}function di(e,t,n){let r={};r.event_time_ms=Math.floor(Date.now()).toString(),r.source_extension_json_proto3=JSON.stringify({messaging_client_event:t}),n&&(r.compliance_data=hi(n)),e.logEvents.push(r)}function hi(e){return{privacy_context:{prequest:{origin_associated_product_id:e}}}}function pi(e,t){let n=[];for(let r=0;r<e.length;r++)n.push(e.charAt(r)),r<t.length&&n.push(t.charAt(r));return n.join("")}async function gi(e,t){var n,r;let{newSubscription:i}=e;if(!i){await Ct(t);return}let o=await xe(t.firebaseDependencies);await Ct(t),t.vapidKey=(r=(n=o?.subscriptionOptions)===null||n===void 0?void 0:n.vapidKey)!==null&&r!==void 0?r:Dt,await ei(t)}async function mi(e,t){let n=yi(e);if(!n)return;t.deliveryMetricsExportedToBigQueryEnabled&&await li(t,n);let r=await xt();if(vi(r))return Ei(r,n);if(n.notification&&await Ii(wi(n)),!!t&&t.onBackgroundMessageHandler){let i=ii(n);typeof t.onBackgroundMessageHandler=="function"?await t.onBackgroundMessageHandler(i):t.onBackgroundMessageHandler.next(i)}}async function bi(e){var t,n;let r=(n=(t=e.notification)===null||t===void 0?void 0:t.data)===null||n===void 0?void 0:n[Tt];if(r){if(e.action)return}else return;e.stopImmediatePropagation(),e.notification.close();let i=Si(r);if(!i)return;let o=new URL(i,self.location.href),s=new URL(self.location.origin);if(o.host!==s.host)return;let a=await _i(o);if(a?a=await a.focus():(a=await self.clients.openWindow(i),await ui(3e3)),!!a)return r.messageType=Z.NOTIFICATION_CLICKED,r.isFirebaseMessaging=!0,a.postMessage(r)}function wi(e){let t=Object.assign({},e.notification);return t.data={[Tt]:e},t}function yi({data:e}){if(!e)return null;try{return e.json()}catch{return null}}async function _i(e){let t=await xt();for(let n of t){let r=new URL(n.url,self.location.href);if(e.host===r.host)return n}return null}function vi(e){return e.some(t=>t.visibilityState==="visible"&&!t.url.startsWith("chrome-extension://"))}function Ei(e,t){t.isFirebaseMessaging=!0,t.messageType=Z.PUSH_RECEIVED;for(let n of e)n.postMessage(t)}function xt(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function Ii(e){var t;let{actions:n}=e,{maxActions:r}=Notification;return n&&r&&n.length>r&&console.warn(`This browser only supports ${r} actions. The remaining actions will not be displayed.`),self.registration.showNotification((t=e.title)!==null&&t!==void 0?t:"",e)}function Si(e){var t,n,r;let i=(n=(t=e.fcmOptions)===null||t===void 0?void 0:t.link)!==null&&n!==void 0?n:(r=e.notification)===null||r===void 0?void 0:r.click_action;return i||(ci(e.data)?self.location.origin:null)}function Ci(e){if(!e||!e.options)throw Te("App Configuration Object");if(!e.name)throw Te("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let r of t)if(!n[r])throw Te(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function Te(e){return h.create("missing-app-config-values",{valueName:e})}function Di(){E(new d("messaging-sw",Ai,"PUBLIC"))}async function Ti(){return P()&&await F()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function ki(e,t){if(self.document!==void 0)throw h.create("only-available-in-sw");return e.onBackgroundMessageHandler=t,()=>{e.onBackgroundMessageHandler=null}}function Nt(e=we()){return Ti().then(t=>{if(!t)throw h.create("unsupported-browser")},t=>{throw h.create("indexed-db-unsupported")}),N(te(e),"messaging-sw").getImmediate()}function Mt(e,t){return e=te(e),ki(e,t)}var Dt,$r,Tt,jr,Hr,Vr,Y,Z,Ae,Wr,St,qr,Gr,T,De,Yr,h,Xr,ke,Ai,Bt=p(()=>{It();H();z();k();M();Dt="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",$r="https://fcmregistrations.googleapis.com/v1",Tt="FCM_MSG",jr="google.c.a.c_id",Hr=3,Vr=1;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Y||(Y={}));(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(Z||(Z={}));Ae="fcm_token_details_db",Wr=5,St="fcm_token_object_Store";qr="firebase-messaging-database",Gr=1,T="firebase-messaging-store",De=null;Yr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},h=new b("messaging","Messaging",Yr);Xr=10080*60*1e3;pi("AzSCbw63g1R0nCw85jG8","Iaya3yLKwmgvh7cF0q4");ke=class{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;let i=Ci(t);this.firebaseDependencies={app:t,appConfig:i,installations:n,analyticsProvider:r}}_delete(){return Promise.resolve()}};Ai=e=>{let t=new ke(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(mi(n,t))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(gi(n,t))}),self.addEventListener("notificationclick",n=>{n.waitUntil(bi(n))}),t};Di()});var Rt=p(()=>{Bt()});var xi=jt(()=>{nt();Rt();var Pt=new URL(location.href).searchParams,Lt=Pt.get("config"),Oi=Pt.get("v")||"1.0.0"+Date.now(),Ft=`walletwise-cache-${Oi}`;self.addEventListener("install",e=>{self.skipWaiting()});self.addEventListener("activate",e=>{e.waitUntil(Promise.all([clients.claim(),caches.keys().then(t=>Promise.all(t.map(n=>{if(n!==Ft)return caches.delete(n)})))]))});self.addEventListener("fetch",e=>{let t=new URL(e.request.url);t.pathname.includes("@vite")||t.searchParams.has("token")||t.pathname.includes("node_modules")||e.request.headers.get("Upgrade")==="websocket"||e.request.method==="GET"&&t.origin===self.location.origin&&t.protocol.startsWith("http")&&e.respondWith(caches.match(e.request).then(n=>n||fetch(e.request).then(r=>{if(!r||r.status!==200||r.type!=="basic")return r;let i=r.clone();return caches.open(Ft).then(o=>{o.put(e.request,i)}),r})))});if(Lt){let e=JSON.parse(Lt);be(e);let t=Nt();Mt(t,n=>{let r=n.notification?.title||"WalletWise Journal",i={body:n.notification?.body||"",icon:"/favicon/favicon-96x96.png"};return self.registration.showNotification(r,i)}),self.addEventListener("notificationclick",n=>{n.notification.close(),n.waitUntil(clients.matchAll({type:"window",includeUncontrolled:!0}).then(r=>{for(let i of r)if(i.url.includes("/")&&"focus"in i)return i.focus();if(clients.openWindow)return clients.openWindow("/")}))})}else console.error("[Notification] Firebase config not found in URL parameters.")});xi();})();
/*! Bundled license information:

@firebase/util/dist/index.esm2017.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2022 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2025 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/component/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/logger/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/app/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2023 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

firebase/app/dist/esm/index.esm.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/installations/dist/esm/index.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@firebase/messaging/dist/esm/index.sw.esm2017.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2018 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
   * in compliance with the License. You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software distributed under the License
   * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
   * or implied. See the License for the specific language governing permissions and limitations under
   * the License.
   *)
  (**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
  (**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)
*/
