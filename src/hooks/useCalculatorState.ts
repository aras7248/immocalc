'use client';
import {useState} from 'react';
import {DEFAULT_PROJECTION_SETTINGS} from '@/lib/projection';
import {initialCalcState,initialRevState,type CalcState,type ReverseState} from '@/domain/immocalc/state';
export function useCalculatorState(){
 const [premiumSettings,setPremiumSettings]=useState(DEFAULT_PROJECTION_SETTINGS);
 const [calc,setCalc]=useState<CalcState>(initialCalcState);const [rev,setRev]=useState<ReverseState>(initialRevState);
 const [mieten,setMieten]=useState<string[]>(['']);const [rentIncreaseInput,setRentIncreaseInput]=useState('0');const [scenarioCostInput,setScenarioCostInput]=useState('0');
 return {premiumSettings,setPremiumSettings,calc,setCalc,rev,setRev,mieten,setMieten,rentIncreaseInput,setRentIncreaseInput,scenarioCostInput,setScenarioCostInput};
}
