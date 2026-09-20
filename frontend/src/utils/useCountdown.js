import {useEffect,useState} from 'react';
export default function useCountdown(expiresAt){const[,tick]=useState(0);useEffect(()=>{if(!expiresAt)return;const id=setInterval(()=>tick(x=>x+1),1000);return()=>clearInterval(id)},[expiresAt]);return expiresAt?Math.max(0,Math.ceil((expiresAt-Date.now())/1000)):0}
