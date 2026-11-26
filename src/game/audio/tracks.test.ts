import { expect, it, vi } from 'vitest';
import { MAIN_THEME, nextMusic } from './tracks';
import { AudioDirector } from './audio';

it.each(['spring','summer','autumn','winter'] as const)('takes turns between Riverside Journey and a %s piece, never one song twice in a row', scene => {
  let file: string | null = MAIN_THEME;
  const played: Array<string|null> = [file];
  for (let i = 0; i < 6; i++) { file = nextMusic(scene,file); played.push(file); }
  for (let i = 1; i < played.length; i++) expect(played[i]).not.toBe(played[i - 1]);
  expect(played.filter(f => f === MAIN_THEME)).toHaveLength(4);
});

it('uses the latest season for the next piece, and never leaves a silence', () => {
  expect(nextMusic('winter','summer.m4a')).toBe(MAIN_THEME);
  expect(nextMusic('winter',MAIN_THEME)).toBe('winter.m4a');
  expect(nextMusic('spring','winter.m4a')).toBe(MAIN_THEME);
  expect(nextMusic('spring',MAIN_THEME)).toBe('summer.m4a');
  expect(nextMusic('menu',MAIN_THEME)).toBe('summer.m4a');
  // A missing file: the other piece follows itself rather than stopping.
  expect(nextMusic('summer','summer.m4a',new Set([MAIN_THEME]))).toBe('summer.m4a');
  expect(nextMusic('winter',MAIN_THEME,new Set(['winter.m4a']))).toBe(MAIN_THEME);
});

it('does not restart or interrupt a playing theme when a season changes', () => {
  const setMusic = vi.fn();
  const director = Object.assign(Object.create(AudioDirector.prototype),{
    scene:'winter',activeDeck:0,decks:[{file:MAIN_THEME,wanted:true},{}],failedTracks:new Set(),
    ctx:null,amb:null,setMusic,scheduleBirds:vi.fn(),
  });
  director.applyScene(false);
  expect(setMusic).not.toHaveBeenCalled();
  director.applyScene(true);
  expect(setMusic).toHaveBeenCalledWith(MAIN_THEME,2.5);
  setMusic.mockClear(); director.scene='menu';director.applyScene(false);
  expect(setMusic).toHaveBeenCalledWith(MAIN_THEME,expect.any(Number));
});

it('crossfades from a seasonal track to the theme and then back to the current seasonal piece', () => {
  const deck = (file: string | null) => {
    const d = {file,wanted:!!file,quietFor:0,el:{paused:false,duration:180,currentTime:179},
      isQuiet:()=>false,load:vi.fn(),resume:vi.fn(),fadeTo:vi.fn(),stop:vi.fn()};
    d.load.mockImplementation((next:string)=>{d.file=next;});
    d.stop.mockImplementation(()=>{d.file=null;});
    d.fadeTo.mockImplementation((_level:number,_seconds:number,done?:()=>void)=>done?.());
    return d;
  };
  const winter = deck('winter.m4a'), theme = deck(null);
  const director = Object.assign(Object.create(AudioDirector.prototype),{
    scene:'winter',activeDeck:0,decks:[winter,theme],hidden:false,failedTracks:new Set(),
  });
  director.relayTick();
  expect(theme.load).toHaveBeenCalledWith(MAIN_THEME);
  expect(theme.resume).toHaveBeenCalledOnce();
  expect(director.activeDeck).toBe(1);
  director.relayTick();
  expect(winter.load).toHaveBeenCalledWith('winter.m4a');
  expect(director.activeDeck).toBe(0);
});
