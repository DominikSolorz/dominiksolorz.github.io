// Only an allowlisted view name is persisted. This grants no account or PIN access.
export function createViewMemory({key,routes,fallback,storage=()=>localStorage}) {
  const allowed=new Set(routes);
  return {
    read(requested,legacy){
      if(allowed.has(requested))return requested;
      try{const saved=storage().getItem(key);if(allowed.has(saved))return saved;}catch{}
      return allowed.has(legacy)?legacy:fallback;
    },
    save(view){if(!allowed.has(view))return false;try{storage().setItem(key,view);return true;}catch{return false;}}
  };
}
