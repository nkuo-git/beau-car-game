// N4 街車（自己設計的街車，沒有真的牌子）的車殼：moto-body.mjs 沒有整流罩的那一版（油箱＋座墊車尾）；node make-car.mjs n4 0.008
import { makeMotoSDF } from './moto-body.mjs';
export const BOUNDS = [-0.90, 0.64, 0.50, 1.03, 0.24];
export const makeSDF = () => makeMotoSDF({ fairing: false });
