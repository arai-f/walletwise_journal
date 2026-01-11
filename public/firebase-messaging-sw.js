(()=>{var d=(e,t)=>()=>(e&&(t=e(e=0)),t);var $t=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var Le,Pe=d(()=>{Le=()=>{}});function Vt(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}function P(){try{return typeof indexedDB=="object"}catch{return!1}}function F(){return new Promise((e,t)=>{try{let n=!0,r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{t(i.error?.message||"")}}catch(n){t(n)}})}function Gt(e,t){return e.replace(Jt,(n,r)=>{let i=t[r];return i!=null?String(i):`<${r}?>`})}function $(e,t){if(e===t)return!0;let n=Object.keys(e),r=Object.keys(t);for(let i of n){if(!r.includes(i))return!1;let o=e[i],s=t[i];if(Fe(o)&&Fe(s)){if(!$(o,s))return!1}else if(o!==s)return!1}for(let i of r)if(!n.includes(i))return!1;return!0}function Fe(e){return e!==null&&typeof e=="object"}function Ve(e){return e&&e._delegate?e._delegate:e}var $e,Ht,He,Q,jt,X,je,Ut,Wt,zt,Kt,ee,L,qt,g,m,Jt,Hi,T=d(()=>{Pe();$e=function(e){let t=[],n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},Ht=function(e){let t=[],n=0,r=0;for(;n<e.length;){let i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){let o=e[n++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){let o=e[n++],s=e[n++],c=e[n++],u=((i&7)<<18|(o&63)<<12|(s&63)<<6|c&63)-65536;t[r++]=String.fromCharCode(55296+(u>>10)),t[r++]=String.fromCharCode(56320+(u&1023))}else{let o=e[n++],s=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|s&63)}}return t.join("")},He={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<e.length;i+=3){let o=e[i],s=i+1<e.length,c=s?e[i+1]:0,u=i+2<e.length,a=u?e[i+2]:0,M=o>>2,k=(o&3)<<4|c>>4,B=(c&15)<<2|a>>6,R=a&63;u||(R=64,s||(B=64)),r.push(n[M],n[k],n[B],n[R])}return r.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray($e(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):Ht(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<e.length;){let o=n[e.charAt(i++)],c=i<e.length?n[e.charAt(i)]:0;++i;let a=i<e.length?n[e.charAt(i)]:64;++i;let k=i<e.length?n[e.charAt(i)]:64;if(++i,o==null||c==null||a==null||k==null)throw new Q;let B=o<<2|c>>4;if(r.push(B),a!==64){let R=c<<4&240|a>>2;if(r.push(R),k!==64){let Ft=a<<6&192|k;r.push(Ft)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}},Q=class extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}},jt=function(e){let t=$e(e);return He.encodeByteArray(t,!0)},X=function(e){return jt(e).replace(/\./g,"")},je=function(e){try{return He.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};Ut=()=>Vt().__FIREBASE_DEFAULTS__,Wt=()=>{if(typeof process>"u"||typeof process.env>"u")return;let e=process.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},zt=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&je(e[1]);return t&&JSON.parse(t)},Kt=()=>{try{return Le()||Ut()||Wt()||zt()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}},ee=()=>Kt()?.config;L=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,r))}}};qt="FirebaseError",g=class e extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=qt,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,m.prototype.create)}},m=class{constructor(t,n,r){this.service=t,this.serviceName=n,this.errors=r}create(t,...n){let r=n[0]||{},i=`${this.service}/${t}`,o=this.errors[t],s=o?Gt(o,r):"Error",c=`${this.serviceName}: ${s} (${i}).`;return new g(i,c,r)}};Jt=/\{\$([^}]+)}/g;Hi=14400*1e3;});function Yt(e){return e===S?void 0:e}function Zt(e){return e.instantiationMode==="EAGER"}var l,S,te,H,j=d(()=>{T();l=class{constructor(t,n,r){this.name=t,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}};S="[DEFAULT]";te=class{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){let n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){let r=new L;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{let i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){let n=this.normalizeInstanceIdentifier(t?.identifier),r=t?.optional??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Zt(t))try{this.getOrInitializeService({instanceIdentifier:S})}catch{}for(let[n,r]of this.instancesDeferred.entries()){let i=this.normalizeInstanceIdentifier(n);try{let o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=S){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){let t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=S){return this.instances.has(t)}getOptions(t=S){return this.instancesOptions.get(t)||{}}initialize(t={}){let{options:n={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(let[o,s]of this.instancesDeferred.entries()){let c=this.normalizeInstanceIdentifier(o);r===c&&s.resolve(i)}return i}onInit(t,n){let r=this.normalizeInstanceIdentifier(n),i=this.onInitCallbacks.get(r)??new Set;i.add(t),this.onInitCallbacks.set(r,i);let o=this.instances.get(r);return o&&t(o,r),()=>{i.delete(t)}}invokeOnInitCallbacks(t,n){let r=this.onInitCallbacks.get(n);if(r)for(let i of r)try{i(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Yt(t),options:n}),this.instances.set(t,r),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=S){return this.component?this.component.multipleInstances?t:S:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}};H=class{constructor(t){this.name=t,this.providers=new Map}addComponent(t){let n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);let n=new te(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}}});var Qt,f,Xt,en,tn,nn,V,Ue=d(()=>{Qt=[];(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));Xt={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},en=f.INFO,tn={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},nn=(e,t,...n)=>{if(t<e.logLevel)return;let r=new Date().toISOString(),i=tn[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)},V=class{constructor(t){this.name=t,this._logLevel=en,this._logHandler=nn,this._userLogHandler=null,Qt.push(this)}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Xt[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}}});function on(){return We||(We=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function sn(){return ze||(ze=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}function an(e){let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("success",o),e.removeEventListener("error",s)},o=()=>{n(h(e.result)),i()},s=()=>{r(e.error),i()};e.addEventListener("success",o),e.addEventListener("error",s)});return t.then(n=>{n instanceof IDBCursor&&Ke.set(n,e)}).catch(()=>{}),oe.set(t,e),t}function cn(e){if(re.has(e))return;let t=new Promise((n,r)=>{let i=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",s),e.removeEventListener("abort",s)},o=()=>{n(),i()},s=()=>{r(e.error||new DOMException("AbortError","AbortError")),i()};e.addEventListener("complete",o),e.addEventListener("error",s),e.addEventListener("abort",s)});re.set(e,t)}function Ge(e){ie=e(ie)}function un(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){let r=e.call(U(this),t,...n);return qe.set(r,t.sort?t.sort():[t]),h(r)}:sn().includes(e)?function(...t){return e.apply(U(this),t),h(Ke.get(this))}:function(...t){return h(e.apply(U(this),t))}}function fn(e){return typeof e=="function"?un(e):(e instanceof IDBTransaction&&cn(e),rn(e,on())?new Proxy(e,ie):e)}function h(e){if(e instanceof IDBRequest)return an(e);if(ne.has(e))return ne.get(e);let t=fn(e);return t!==e&&(ne.set(e,t),oe.set(t,e)),t}var rn,We,ze,Ke,re,qe,ne,oe,ie,U,se=d(()=>{rn=(e,t)=>t.some(n=>e instanceof n);Ke=new WeakMap,re=new WeakMap,qe=new WeakMap,ne=new WeakMap,oe=new WeakMap;ie={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return re.get(e);if(t==="objectStoreNames")return e.objectStoreNames||qe.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return h(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};U=e=>oe.get(e)});function I(e,t,{blocked:n,upgrade:r,blocking:i,terminated:o}={}){let s=indexedDB.open(e,t),c=h(s);return r&&s.addEventListener("upgradeneeded",u=>{r(h(s.result),u.oldVersion,u.newVersion,h(s.transaction),u)}),n&&s.addEventListener("blocked",u=>n(u.oldVersion,u.newVersion,u)),c.then(u=>{o&&u.addEventListener("close",()=>o()),i&&u.addEventListener("versionchange",a=>i(a.oldVersion,a.newVersion,a))}).catch(()=>{}),c}function W(e,{blocked:t}={}){let n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",r=>t(r.oldVersion,r)),h(n).then(()=>{})}function Je(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(ae.get(t))return ae.get(t);let n=t.replace(/FromIndex$/,""),r=t!==n,i=dn.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||ln.includes(n)))return;let o=async function(s,...c){let u=this.transaction(s,i?"readwrite":"readonly"),a=u.store;return r&&(a=a.index(c.shift())),(await Promise.all([a[n](...c),i&&u.done]))[0]};return ae.set(t,o),o}var ln,dn,ae,z=d(()=>{se();se();ln=["get","getKey","getAll","getAllKeys","count"],dn=["put","add","delete","clear"],ae=new Map;Ge(e=>({...e,get:(t,n,r)=>Je(t,n)||e.get(t,n,r),has:(t,n)=>!!Je(t,n)||e.has(t,n)}))});function hn(e){return e.getComponent()?.type==="VERSION"}function Ze(e,t){try{e.container.addComponent(t)}catch(n){b.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function E(e){let t=e.name;if(de.has(t))return b.debug(`There were multiple attempts to register component ${t}.`),!1;de.set(t,e);for(let n of K.values())Ze(n,e);for(let n of jn.values())Ze(n,e);return!0}function N(e,t){let n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}function me(e,t={}){let n=e;typeof t!="object"&&(t={name:t});let r={name:le,automaticDataCollectionEnabled:!0,...t},i=r.name;if(typeof i!="string"||!i)throw y.create("bad-app-name",{appName:String(i)});if(n||(n=ee()),!n)throw y.create("no-options");let o=K.get(i);if(o){if($(n,o.options)&&$(r,o.config))return o;throw y.create("duplicate-app",{appName:i})}let s=new H(i);for(let u of de.values())s.addComponent(u);let c=new he(n,r,s);return K.set(i,c),c}function be(e=le){let t=K.get(e);if(!t&&e===le&&ee())return me();if(!t)throw y.create("no-app",{appName:e});return t}function _(e,t,n){let r=Hn[e]??e;n&&(r+=`-${n}`);let i=r.match(/\s|\//),o=t.match(/\s|\//);if(i||o){let s=[`Unable to register library "${r}" with version "${t}":`];i&&s.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&o&&s.push("and"),o&&s.push(`version name "${t}" contains illegal characters (whitespace or "/")`),b.warn(s.join(" "));return}E(new l(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}function tt(){return ce||(ce=I(Un,Wn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(O)}catch(n){console.warn(n)}}}}).catch(e=>{throw y.create("idb-open",{originalErrorMessage:e.message})})),ce}async function zn(e){try{let n=(await tt()).transaction(O),r=await n.objectStore(O).get(nt(e));return await n.done,r}catch(t){if(t instanceof g)b.warn(t.message);else{let n=y.create("idb-get",{originalErrorMessage:t?.message});b.warn(n.message)}}}async function Qe(e,t){try{let r=(await tt()).transaction(O,"readwrite");await r.objectStore(O).put(t,nt(e)),await r.done}catch(n){if(n instanceof g)b.warn(n.message);else{let r=y.create("idb-set",{originalErrorMessage:n?.message});b.warn(r.message)}}}function nt(e){return`${e.name}!${e.options.appId}`}function Xe(){return new Date().toISOString().substring(0,10)}function Gn(e,t=Kn){let n=[],r=e.slice();for(let i of e){let o=n.find(s=>s.agent===i.agent);if(o){if(o.dates.push(i.date),et(n)>t){o.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),et(n)>t){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}function et(e){return X(JSON.stringify({version:2,heartbeats:e})).length}function Jn(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}function Yn(e){E(new l("platform-logger",t=>new ue(t),"PRIVATE")),E(new l("heartbeat",t=>new pe(t),"PRIVATE")),_(fe,Ye,e),_(fe,Ye,"esm2020"),_("fire-js","")}var ue,fe,Ye,b,pn,gn,mn,bn,wn,yn,_n,En,Sn,In,Cn,vn,An,Dn,Tn,kn,On,Nn,xn,Mn,Bn,Rn,Ln,Pn,Fn,$n,le,Hn,K,jn,de,Vn,y,he,Un,Wn,O,ce,Kn,qn,pe,ge,x=d(()=>{j();Ue();T();T();z();ue=class{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(hn(n)){let r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}};fe="@firebase/app",Ye="0.14.6";b=new V("@firebase/app"),pn="@firebase/app-compat",gn="@firebase/analytics-compat",mn="@firebase/analytics",bn="@firebase/app-check-compat",wn="@firebase/app-check",yn="@firebase/auth",_n="@firebase/auth-compat",En="@firebase/database",Sn="@firebase/data-connect",In="@firebase/database-compat",Cn="@firebase/functions",vn="@firebase/functions-compat",An="@firebase/installations",Dn="@firebase/installations-compat",Tn="@firebase/messaging",kn="@firebase/messaging-compat",On="@firebase/performance",Nn="@firebase/performance-compat",xn="@firebase/remote-config",Mn="@firebase/remote-config-compat",Bn="@firebase/storage",Rn="@firebase/storage-compat",Ln="@firebase/firestore",Pn="@firebase/ai",Fn="@firebase/firestore-compat",$n="firebase";le="[DEFAULT]",Hn={[fe]:"fire-core",[pn]:"fire-core-compat",[mn]:"fire-analytics",[gn]:"fire-analytics-compat",[wn]:"fire-app-check",[bn]:"fire-app-check-compat",[yn]:"fire-auth",[_n]:"fire-auth-compat",[En]:"fire-rtdb",[Sn]:"fire-data-connect",[In]:"fire-rtdb-compat",[Cn]:"fire-fn",[vn]:"fire-fn-compat",[An]:"fire-iid",[Dn]:"fire-iid-compat",[Tn]:"fire-fcm",[kn]:"fire-fcm-compat",[On]:"fire-perf",[Nn]:"fire-perf-compat",[xn]:"fire-rc",[Mn]:"fire-rc-compat",[Bn]:"fire-gcs",[Rn]:"fire-gcs-compat",[Ln]:"fire-fst",[Fn]:"fire-fst-compat",[Pn]:"fire-vertex","fire-js":"fire-js",[$n]:"fire-js-all"};K=new Map,jn=new Map,de=new Map;Vn={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},y=new m("app","Firebase",Vn);he=class{constructor(t,n,r){this._isDeleted=!1,this._options={...t},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new l("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw y.create("app-deleted",{appName:this._name})}};Un="firebase-heartbeat-database",Wn=1,O="firebase-heartbeat-store",ce=null;Kn=1024,qn=30,pe=class{constructor(t){this.container=t,this._heartbeatsCache=null;let n=this.container.getProvider("app").getImmediate();this._storage=new ge(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){try{let n=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),r=Xe();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===r||this._heartbeatsCache.heartbeats.some(i=>i.date===r))return;if(this._heartbeatsCache.heartbeats.push({date:r,agent:n}),this._heartbeatsCache.heartbeats.length>qn){let i=Jn(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(i,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(t){b.warn(t)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return"";let t=Xe(),{heartbeatsToSend:n,unsentEntries:r}=Gn(this._heartbeatsCache.heartbeats),i=X(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=t,r.length>0?(this._heartbeatsCache.heartbeats=r,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(t){return b.warn(t),""}}};ge=class{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return P()?F().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let n=await zn(this.app);return n?.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){let r=await this.read();return Qe(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){let r=await this.read();return Qe(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}};Yn("")});var Zn,Qn,rt=d(()=>{x();x();Zn="firebase",Qn="12.7.0";_(Zn,Qn,"app")});function ft(e){return e instanceof g&&e.code.includes("request-failed")}function lt({projectId:e}){return`${Xn}/projects/${e}/installations`}function dt(e){return{token:e.token,requestStatus:2,expiresIn:or(e.expiresIn),creationTime:Date.now()}}async function ht(e,t){let r=(await t.json()).error;return v.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function pt({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function ir(e,{refreshToken:t}){let n=pt(e);return n.append("Authorization",sr(t)),n}async function gt(e){let t=await e();return t.status>=500&&t.status<600?e():t}function or(e){return Number(e.replace("s","000"))}function sr(e){return`${ut} ${e}`}async function ar({appConfig:e,heartbeatServiceProvider:t},{fid:n}){let r=lt(e),i=pt(e),o=t.getImmediate({optional:!0});if(o){let a=await o.getHeartbeatsHeader();a&&i.append("x-firebase-client",a)}let s={fid:n,authVersion:ut,appId:e.appId,sdkVersion:ct},c={method:"POST",headers:i,body:JSON.stringify(s)},u=await gt(()=>fetch(r,c));if(u.ok){let a=await u.json();return{fid:a.fid||n,registrationStatus:2,refreshToken:a.refreshToken,authToken:dt(a.authToken)}}else throw await ht("Create Installation",u)}function mt(e){return new Promise(t=>{setTimeout(t,e)})}function cr(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}function fr(){try{let e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;let n=lr(e);return ur.test(n)?n:_e}catch{return _e}}function lr(e){return cr(e).substr(0,22)}function G(e){return`${e.appName}!${e.appId}`}function wt(e,t){let n=G(e);yt(n,t),dr(n,t)}function yt(e,t){let n=bt.get(e);if(n)for(let r of n)r(t)}function dr(e,t){let n=hr();n&&n.postMessage({key:e,fid:t}),pr()}function hr(){return!C&&"BroadcastChannel"in self&&(C=new BroadcastChannel("[Firebase] FID Change"),C.onmessage=e=>{yt(e.data.key,e.data.fid)}),C}function pr(){bt.size===0&&C&&(C.close(),C=null)}function Se(){return we||(we=I(gr,mr,{upgrade:(e,t)=>{t===0&&e.createObjectStore(A)}})),we}async function q(e,t){let n=G(e),i=(await Se()).transaction(A,"readwrite"),o=i.objectStore(A),s=await o.get(n);return await o.put(t,n),await i.done,(!s||s.fid!==t.fid)&&wt(e,t.fid),t}async function _t(e){let t=G(e),r=(await Se()).transaction(A,"readwrite");await r.objectStore(A).delete(t),await r.done}async function J(e,t){let n=G(e),i=(await Se()).transaction(A,"readwrite"),o=i.objectStore(A),s=await o.get(n),c=t(s);return c===void 0?await o.delete(n):await o.put(c,n),await i.done,c&&(!s||s.fid!==c.fid)&&wt(e,c.fid),c}async function Ie(e){let t,n=await J(e.appConfig,r=>{let i=br(r),o=wr(e,i);return t=o.registrationPromise,o.installationEntry});return n.fid===_e?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function br(e){let t=e||{fid:fr(),registrationStatus:0};return Et(t)}function wr(e,t){if(t.registrationStatus===0){if(!navigator.onLine){let i=Promise.reject(v.create("app-offline"));return{installationEntry:t,registrationPromise:i}}let n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=yr(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:_r(e)}:{installationEntry:t}}async function yr(e,t){try{let n=await ar(e,t);return q(e.appConfig,n)}catch(n){throw ft(n)&&n.customData.serverCode===409?await _t(e.appConfig):await q(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function _r(e){let t=await it(e.appConfig);for(;t.registrationStatus===1;)await mt(100),t=await it(e.appConfig);if(t.registrationStatus===0){let{installationEntry:n,registrationPromise:r}=await Ie(e);return r||n}return t}function it(e){return J(e,t=>{if(!t)throw v.create("installation-not-found");return Et(t)})}function Et(e){return Er(e)?{fid:e.fid,registrationStatus:0}:e}function Er(e){return e.registrationStatus===1&&e.registrationTime+at<Date.now()}async function Sr({appConfig:e,heartbeatServiceProvider:t},n){let r=Ir(e,n),i=ir(e,n),o=t.getImmediate({optional:!0});if(o){let a=await o.getHeartbeatsHeader();a&&i.append("x-firebase-client",a)}let s={installation:{sdkVersion:ct,appId:e.appId}},c={method:"POST",headers:i,body:JSON.stringify(s)},u=await gt(()=>fetch(r,c));if(u.ok){let a=await u.json();return dt(a)}else throw await ht("Generate Auth Token",u)}function Ir(e,{fid:t}){return`${lt(e)}/${t}/authTokens:generate`}async function Ce(e,t=!1){let n,r=await J(e.appConfig,o=>{if(!St(o))throw v.create("not-registered");let s=o.authToken;if(!t&&Ar(s))return o;if(s.requestStatus===1)return n=Cr(e,t),o;{if(!navigator.onLine)throw v.create("app-offline");let c=Tr(o);return n=vr(e,c),c}});return n?await n:r.authToken}async function Cr(e,t){let n=await ot(e.appConfig);for(;n.authToken.requestStatus===1;)await mt(100),n=await ot(e.appConfig);let r=n.authToken;return r.requestStatus===0?Ce(e,t):r}function ot(e){return J(e,t=>{if(!St(t))throw v.create("not-registered");let n=t.authToken;return kr(n)?{...t,authToken:{requestStatus:0}}:t})}async function vr(e,t){try{let n=await Sr(e,t),r={...t,authToken:n};return await q(e.appConfig,r),n}catch(n){if(ft(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await _t(e.appConfig);else{let r={...t,authToken:{requestStatus:0}};await q(e.appConfig,r)}throw n}}function St(e){return e!==void 0&&e.registrationStatus===2}function Ar(e){return e.requestStatus===2&&!Dr(e)}function Dr(e){let t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+er}function Tr(e){let t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function kr(e){return e.requestStatus===1&&e.requestTime+at<Date.now()}async function Or(e){let t=e,{installationEntry:n,registrationPromise:r}=await Ie(t);return r?r.catch(console.error):Ce(t).catch(console.error),n.fid}async function Nr(e,t=!1){let n=e;return await xr(n),(await Ce(n,t)).token}async function xr(e){let{registrationPromise:t}=await Ie(e);t&&await t}function Mr(e){if(!e||!e.options)throw ye("App Configuration");if(!e.name)throw ye("App Name");let t=["projectId","apiKey","appId"];for(let n of t)if(!e.options[n])throw ye(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function ye(e){return v.create("missing-app-config-values",{valueName:e})}function Pr(){E(new l(It,Rr,"PUBLIC")),E(new l(Br,Lr,"PRIVATE"))}var st,Ee,at,ct,ut,Xn,er,tr,nr,rr,v,ur,_e,bt,C,gr,mr,A,we,It,Br,Rr,Lr,Ct=d(()=>{x();j();T();z();st="@firebase/installations",Ee="0.6.19";at=1e4,ct=`w:${Ee}`,ut="FIS_v2",Xn="https://firebaseinstallations.googleapis.com/v1",er=3600*1e3,tr="installations",nr="Installations";rr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},v=new m(tr,nr,rr);ur=/^[cdef][\w-]{21}$/,_e="";bt=new Map;C=null;gr="firebase-installations-database",mr=1,A="firebase-installations-store",we=null;It="installations",Br="installations-internal",Rr=e=>{let t=e.getProvider("app").getImmediate(),n=Mr(t),r=N(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Lr=e=>{let t=e.getProvider("app").getImmediate(),n=N(t,It).getImmediate();return{getId:()=>Or(n),getToken:i=>Nr(n,i)}};Pr();_(st,Ee);_(st,Ee,"esm2020")});function w(e){let t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Vr(e){let t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),i=new Uint8Array(r.length);for(let o=0;o<r.length;++o)i[o]=r.charCodeAt(o);return i}async function Wr(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(ve))return null;let t=null;return(await I(ve,Ur,{upgrade:async(r,i,o,s)=>{if(i<2||!r.objectStoreNames.contains(vt))return;let c=s.objectStore(vt),u=await c.index("fcmSenderId").get(e);if(await c.clear(),!!u){if(i===2){let a=u;if(!a.auth||!a.p256dh||!a.endpoint)return;t={token:a.fcmToken,createTime:a.createTime??Date.now(),subscriptionOptions:{auth:a.auth,p256dh:a.p256dh,endpoint:a.endpoint,swScope:a.swScope,vapidKey:typeof a.vapidKey=="string"?a.vapidKey:w(a.vapidKey)}}}else if(i===3){let a=u;t={token:a.fcmToken,createTime:a.createTime,subscriptionOptions:{auth:w(a.auth),p256dh:w(a.p256dh),endpoint:a.endpoint,swScope:a.swScope,vapidKey:w(a.vapidKey)}}}else if(i===4){let a=u;t={token:a.fcmToken,createTime:a.createTime,subscriptionOptions:{auth:w(a.auth),p256dh:w(a.p256dh),endpoint:a.endpoint,swScope:a.swScope,vapidKey:w(a.vapidKey)}}}}}})).close(),await W(ve),await W("fcm_vapid_details_db"),await W("undefined"),zr(t)?t:null}function zr(e){if(!e||!e.subscriptionOptions)return!1;let{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}function ke(){return Ae||(Ae=I(Kr,qr,{upgrade:(e,t)=>{t===0&&e.createObjectStore(D)}})),Ae}async function Oe(e){let t=xe(e),r=await(await ke()).transaction(D).objectStore(D).get(t);if(r)return r;{let i=await Wr(e.appConfig.senderId);if(i)return await Ne(e,i),i}}async function Ne(e,t){let n=xe(e),i=(await ke()).transaction(D,"readwrite");return await i.objectStore(D).put(t,n),await i.done,t}async function Gr(e){let t=xe(e),r=(await ke()).transaction(D,"readwrite");await r.objectStore(D).delete(t),await r.done}function xe({appConfig:e}){return e.appId}async function Yr(e,t){let n=await Be(e),r=Nt(t),i={method:"POST",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(Me(e.appConfig),i)).json()}catch(s){throw p.create("token-subscribe-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-subscribe-failed",{errorInfo:s})}if(!o.token)throw p.create("token-subscribe-no-token");return o.token}async function Zr(e,t){let n=await Be(e),r=Nt(t.subscriptionOptions),i={method:"PATCH",headers:n,body:JSON.stringify(r)},o;try{o=await(await fetch(`${Me(e.appConfig)}/${t.token}`,i)).json()}catch(s){throw p.create("token-update-failed",{errorInfo:s?.toString()})}if(o.error){let s=o.error.message;throw p.create("token-update-failed",{errorInfo:s})}if(!o.token)throw p.create("token-update-no-token");return o.token}async function Ot(e,t){let r={method:"DELETE",headers:await Be(e)};try{let o=await(await fetch(`${Me(e.appConfig)}/${t}`,r)).json();if(o.error){let s=o.error.message;throw p.create("token-unsubscribe-failed",{errorInfo:s})}}catch(i){throw p.create("token-unsubscribe-failed",{errorInfo:i?.toString()})}}function Me({projectId:e}){return`${Fr}/projects/${e}/registrations`}async function Be({appConfig:e,installations:t}){let n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Nt({p256dh:e,auth:t,endpoint:n,vapidKey:r}){let i={web:{endpoint:n,auth:t,p256dh:e}};return r!==Tt&&(i.web.applicationPubKey=r),i}async function Xr(e){let t=await ti(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:w(t.getKey("auth")),p256dh:w(t.getKey("p256dh"))},r=await Oe(e.firebaseDependencies);if(r){if(ni(r.subscriptionOptions,n))return Date.now()>=r.createTime+Qr?ei(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await Ot(e.firebaseDependencies,r.token)}catch(i){console.warn(i)}return Dt(e.firebaseDependencies,n)}else return Dt(e.firebaseDependencies,n)}async function At(e){let t=await Oe(e.firebaseDependencies);t&&(await Ot(e.firebaseDependencies,t.token),await Gr(e.firebaseDependencies));let n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function ei(e,t){try{let n=await Zr(e.firebaseDependencies,t),r={...t,token:n,createTime:Date.now()};return await Ne(e.firebaseDependencies,r),n}catch(n){throw n}}async function Dt(e,t){let r={token:await Yr(e,t),createTime:Date.now(),subscriptionOptions:t};return await Ne(e,r),r.token}async function ti(e,t){let n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Vr(t)})}function ni(e,t){let n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,i=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&r&&i&&o}function ri(e){let t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return ii(t,e),oi(t,e),si(t,e),t}function ii(e,t){if(!t.notification)return;e.notification={};let n=t.notification.title;n&&(e.notification.title=n);let r=t.notification.body;r&&(e.notification.body=r);let i=t.notification.image;i&&(e.notification.image=i);let o=t.notification.icon;o&&(e.notification.icon=o)}function oi(e,t){t.data&&(e.data=t.data)}function si(e,t){if(!t.fcmOptions&&!t.notification?.click_action)return;e.fcmOptions={};let n=t.fcmOptions?.link??t.notification?.click_action;n&&(e.fcmOptions.link=n);let r=t.fcmOptions?.analytics_label;r&&(e.fcmOptions.analyticsLabel=r)}function ai(e){return typeof e=="object"&&!!e&&$r in e}function ci(e){return new Promise(t=>{setTimeout(t,e)})}async function ui(e,t){let n=fi(t,await e.firebaseDependencies.installations.getId());li(e,n,t.productId)}function fi(e,t){let n={};return e.from&&(n.project_number=e.from),e.fcmMessageId&&(n.message_id=e.fcmMessageId),n.instance_id=t,e.notification?n.message_type=Y.DISPLAY_NOTIFICATION.toString():n.message_type=Y.DATA_MESSAGE.toString(),n.sdk_platform=Hr.toString(),n.package_name=self.origin.replace(/(^\w+:|^)\/\//,""),e.collapse_key&&(n.collapse_key=e.collapse_key),n.event=jr.toString(),e.fcmOptions?.analytics_label&&(n.analytics_label=e.fcmOptions?.analytics_label),n}function li(e,t,n){let r={};r.event_time_ms=Math.floor(Date.now()).toString(),r.source_extension_json_proto3=JSON.stringify({messaging_client_event:t}),n&&(r.compliance_data=di(n)),e.logEvents.push(r)}function di(e){return{privacy_context:{prequest:{origin_associated_product_id:e}}}}function hi(e,t){let n=[];for(let r=0;r<e.length;r++)n.push(e.charAt(r)),r<t.length&&n.push(t.charAt(r));return n.join("")}async function pi(e,t){let{newSubscription:n}=e;if(!n){await At(t);return}let r=await Oe(t.firebaseDependencies);await At(t),t.vapidKey=r?.subscriptionOptions?.vapidKey??Tt,await Xr(t)}async function gi(e,t){let n=wi(e);if(!n)return;t.deliveryMetricsExportedToBigQueryEnabled&&await ui(t,n);let r=await xt();if(_i(r))return Ei(r,n);if(n.notification&&await Si(bi(n)),!!t&&t.onBackgroundMessageHandler){let i=ri(n);typeof t.onBackgroundMessageHandler=="function"?await t.onBackgroundMessageHandler(i):t.onBackgroundMessageHandler.next(i)}}async function mi(e){let t=e.notification?.data?.[kt];if(t){if(e.action)return}else return;e.stopImmediatePropagation(),e.notification.close();let n=Ii(t);if(!n)return;let r=new URL(n,self.location.href),i=new URL(self.location.origin);if(r.host!==i.host)return;let o=await yi(r);if(o?o=await o.focus():(o=await self.clients.openWindow(n),await ci(3e3)),!!o)return t.messageType=Z.NOTIFICATION_CLICKED,t.isFirebaseMessaging=!0,o.postMessage(t)}function bi(e){let t={...e.notification};return t.data={[kt]:e},t}function wi({data:e}){if(!e)return null;try{return e.json()}catch{return null}}async function yi(e){let t=await xt();for(let n of t){let r=new URL(n.url,self.location.href);if(e.host===r.host)return n}return null}function _i(e){return e.some(t=>t.visibilityState==="visible"&&!t.url.startsWith("chrome-extension://"))}function Ei(e,t){t.isFirebaseMessaging=!0,t.messageType=Z.PUSH_RECEIVED;for(let n of e)n.postMessage(t)}function xt(){return self.clients.matchAll({type:"window",includeUncontrolled:!0})}function Si(e){let{actions:t}=e,{maxActions:n}=Notification;return t&&n&&t.length>n&&console.warn(`This browser only supports ${n} actions. The remaining actions will not be displayed.`),self.registration.showNotification(e.title??"",e)}function Ii(e){let t=e.fcmOptions?.link??e.notification?.click_action;return t||(ai(e.data)?self.location.origin:null)}function Ci(e){if(!e||!e.options)throw De("App Configuration Object");if(!e.name)throw De("App Name");let t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(let r of t)if(!n[r])throw De(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function De(e){return p.create("missing-app-config-values",{valueName:e})}function Ai(){E(new l("messaging-sw",vi,"PUBLIC"))}async function Di(){return P()&&await F()&&"PushManager"in self&&"Notification"in self&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}function Mt(e=be()){return Di().then(t=>{if(!t)throw p.create("unsupported-browser")},t=>{throw p.create("indexed-db-unsupported")}),N(Ve(e),"messaging-sw").getImmediate()}var Tt,Fr,kt,$r,Hr,jr,Y,Z,ve,Ur,vt,Kr,qr,D,Ae,Jr,p,Qr,Te,vi,Bt=d(()=>{Ct();j();z();T();x();Tt="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Fr="https://fcmregistrations.googleapis.com/v1",kt="FCM_MSG",$r="google.c.a.c_id",Hr=3,jr=1;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Y||(Y={}));(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(Z||(Z={}));ve="fcm_token_details_db",Ur=5,vt="fcm_token_object_Store";Kr="firebase-messaging-database",qr=1,D="firebase-messaging-store",Ae=null;Jr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},p=new m("messaging","Messaging",Jr);Qr=10080*60*1e3;hi("AzSCbw63g1R0nCw85jG8","Iaya3yLKwmgvh7cF0q4");Te=class{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;let i=Ci(t);this.firebaseDependencies={app:t,appConfig:i,installations:n,analyticsProvider:r}}_delete(){return Promise.resolve()}};vi=e=>{let t=new Te(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return self.addEventListener("push",n=>{n.waitUntil(gi(n,t))}),self.addEventListener("pushsubscriptionchange",n=>{n.waitUntil(pi(n,t))}),self.addEventListener("notificationclick",n=>{n.waitUntil(mi(n))}),t};Ai()});var Rt=d(()=>{Bt()});var Li=$t(()=>{rt();Rt();var Pt=new URL(location.href).searchParams,Lt=Pt.get("config"),Ti=Pt.get("v"),Re=`walletwise-cache-${Ti}`,ki=["@vite","node_modules"];self.addEventListener("install",e=>{self.skipWaiting()});self.addEventListener("activate",e=>{e.waitUntil(Promise.all([clients.claim(),xi()]))});self.addEventListener("fetch",e=>{let t=new URL(e.request.url);if(!Oi(t,e.request)&&!(e.request.method!=="GET"||t.origin!==self.location.origin)){if(Ni(e.request,t)){e.respondWith(Mi(e.request));return}e.respondWith(Bi(e.request))}});function Oi(e,t){return ki.some(n=>e.pathname.includes(n))||e.searchParams.has("token")||t.headers.get("Upgrade")==="websocket"||self.location.hostname==="localhost"||self.location.hostname==="127.0.0.1"}function Ni(e,t){return e.mode==="navigate"||t.pathname.endsWith(".html")||t.pathname==="/"}async function xi(){let e=await caches.keys();return Promise.all(e.map(t=>{if(t!==Re)return caches.delete(t)}))}async function Mi(e){try{let t=await fetch(e);return t&&t.status===200&&(await caches.open(Re)).put(e,t.clone()),t}catch{return caches.match(e)}}async function Bi(e){let t=await caches.match(e);if(t)return t;let n=await fetch(e);return!n||n.status!==200||n.type!=="basic"||(await caches.open(Re)).put(e,n.clone()),n}if(Lt)try{let e=JSON.parse(Lt);me(e);let t=Mt();self.addEventListener("notificationclick",n=>{n.notification.close(),n.waitUntil(Ri(n))})}catch(e){console.error("[Notification] Failed to initialize Firebase:",e)}else console.error("[Notification] Firebase config not found in URL parameters.");async function Ri(e){let t=await clients.matchAll({type:"window",includeUncontrolled:!0});for(let n of t)if(n.url.includes("/")&&"focus"in n)return n.focus();if(clients.openWindow)return clients.openWindow("/")}});Li();})();
/*! Bundled license information:

@firebase/util/dist/index.esm.js:
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

@firebase/component/dist/esm/index.esm.js:
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

@firebase/logger/dist/esm/index.esm.js:
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

@firebase/app/dist/esm/index.esm.js:
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

@firebase/installations/dist/esm/index.esm.js:
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

@firebase/messaging/dist/esm/index.sw.esm.js:
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
