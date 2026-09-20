export const passwordRules=[['upper',v=>/[A-Z]/.test(v),'At least one uppercase letter'],['lower',v=>/[a-z]/.test(v),'At least one lowercase letter'],['special',v=>/[^A-Za-z0-9\s]/.test(v),'At least one special character'],['digit',v=>/\d/.test(v),'At least one digit'],['length',v=>v.length>=8,'At least 8 characters'],['space',v=>!/[\s]/.test(v),'No spaces']];
export const validPassword=v=>passwordRules.every(([,f])=>f(v));
export const useIsFutureDate=()=>{};
