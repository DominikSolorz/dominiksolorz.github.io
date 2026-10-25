export function localDayRange(key) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw Error('Nieprawidłowy dzień archiwum.');
 const [year,month,day]=key.split('-').map(Number),start=new Date(year,month-1,day);
 if(start.getFullYear()!==year||start.getMonth()!==month-1||start.getDate()!==day)throw Error('Nieprawidłowa data archiwum.');
 return [+start,+new Date(year,month-1,day+1)];
}
export function previousLocalDay(date=new Date()) {const result=new Date(date);result.setDate(result.getDate()-1);return result;}
