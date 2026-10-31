// F6 仿賽（自己設計的 600 級仿賽，沒有真的牌子）的車殼：moto-body.mjs 有整流罩的那一版；node make-car.mjs f6 0.008
import { makeMotoSDF } from './moto-body.mjs';
export const BOUNDS = [-0.90, 0.26, 1.05, 1.07, 0.30];
export const makeSDF = () => makeMotoSDF({ fairing: true });
