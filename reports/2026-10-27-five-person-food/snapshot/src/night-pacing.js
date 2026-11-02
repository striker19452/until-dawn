// Keep deployment and challenge previews on the same clock. Compress arrivals,
// while retaining real travel, combat and the complete clearing requirement.
export const NIGHT_PACING=Object.freeze({firstArrival:2,firstChallenge:3,challengeStart:8,warningLead:4,pairGap:8,groupGap:2,maxGap:10});
export function arrivalTime(day,index,total){
 const last=(day%7===0?40:30)+Math.floor((day-1)/7)*4;
 return NIGHT_PACING.firstArrival+index*(last-NIGHT_PACING.firstArrival)/Math.max(1,total-1);
}
