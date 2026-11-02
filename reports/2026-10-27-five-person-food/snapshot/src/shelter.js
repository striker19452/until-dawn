// Indoor occupants do not use the courtyard navigation mesh. They cross this
// doorway when leaving or returning, then remain in the house until called out.
export const HOUSE_DOOR={x:240,y:350};
export const HOUSE_INTERIOR={x:240,y:300};
export const isIndoors=(battle,person)=>battle?.indoorPeople?.[person.id]===true;
export const sleepInterrupted=(battle,person)=>battle?.sleepInterrupted?.[person.id]===true;
export const sleepEligible=(battle,person)=>person.nightRole==='sleep'&&!sleepInterrupted(battle,person);
export function interruptSleep(battle,person){
 if(!sleepEligible(battle,person))return false;
 battle.sleepInterrupted??={};battle.sleepInterrupted[person.id]=true;return true;
}
export function enterHouse(battle,person){battle.indoorPeople[person.id]=true;Object.assign(person,HOUSE_INTERIOR);}
export function leaveHouse(battle,person){delete battle.indoorPeople[person.id];Object.assign(person,HOUSE_DOOR);}
