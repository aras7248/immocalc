'use client';
import {useState} from 'react';
import {initialCalcState,initialRevState,type CalcState,type ReverseState} from '@/domain/immocalc/state';
export function useCalculatorState(){
 const [calc,setCalc]=useState<CalcState>(initialCalcState);const [rev,setRev]=useState<ReverseState>(initialRevState);
 const [mieten,setMieten]=useState<string[]>(['']);const [rentIncreaseInput,setRentIncreaseInput]=useState('0');const [scenarioCostInput,setScenarioCostInput]=useState('0');
 return {calc,setCalc,rev,setRev,mieten,setMieten,rentIncreaseInput,setRentIncreaseInput,scenarioCostInput,setScenarioCostInput};
}
