export const controlBaseClass = 'rounded-md border border-slate-800 bg-slate-900 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

export const controlFieldClass = `${controlBaseClass} px-2.5 py-1.5 text-sm`;
export const textInputClass = `${controlFieldClass} w-full`;
export const compactInputClass = `${controlBaseClass} w-full px-2.5 py-1.5 text-[0.8125rem]`;
export const compactSelectClass = `${controlBaseClass} px-2.5 py-1 text-[0.8125rem]`;

/** Compact inputs inside small pop-overs / inline-edit dialogs */
export const microInputClass = 'rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[0.8125rem] text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

/** Tiny icon-style action buttons (up/down/rename/remove) */
export const iconBtnBase = 'shrink-0 rounded-md border border-slate-800 bg-transparent p-0 text-[0.65rem] focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
export const iconBtnEnabled = `${iconBtnBase} cursor-pointer text-slate-400`;
export const iconBtnDisabled = `${iconBtnBase} cursor-not-allowed text-slate-700`;

export const ghostButtonClass = 'cursor-pointer rounded-lg border border-slate-800 bg-transparent text-slate-400 hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
export const primaryButtonClass = 'cursor-pointer rounded-lg border border-transparent bg-indigo-500 font-semibold text-white hover:bg-indigo-400 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
