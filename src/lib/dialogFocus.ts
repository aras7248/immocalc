/** Explicit keyboard wrap complements the native modal dialog's inert background. */
export function trapDialogFocus(event:{key:string;shiftKey:boolean;currentTarget:HTMLDialogElement;preventDefault:()=>void}){
 if(event.key!=='Tab')return;
 const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(node=>node.getClientRects().length>0);
 const first=nodes[0],last=nodes[nodes.length-1];
 if(!first){event.preventDefault();event.currentTarget.focus();return;}
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
