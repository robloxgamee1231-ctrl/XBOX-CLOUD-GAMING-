import React, { useEffect, useState } from 'react';
import { Gamepad2, Vibrate } from 'lucide-react';

interface ControllerTesterProps {
  deadzone: number;
  onDeadzoneChange: (dz: number) => void;
}

interface PadSnapshot {
  id: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; value: number }>;
  hasRumble: boolean;
}

const BUTTON_NAMES = [
  'A / Cross',
  'B / Circle',
  'X / Square',
  'Y / Triangle',
  'LB / L1',
  'RB / R1',
  'LT / L2',
  'RT / R2',
  'View / Share',
  'Menu / Options',
  'L3',
  'R3',
  'D-Up',
  'D-Down',
  'D-Left',
  'D-Right',
  'Xbox / PS',
];

export const ControllerTester: React.FC<ControllerTesterProps> = ({ deadzone, onDeadzoneChange }) => {
  const [pad, setPad] = useState<PadSnapshot | null>(null);

  useEffect(() => {
    let raf = 0;
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const first = pads.find(Boolean);
      if (first) {
        const actuator = (first as Gamepad & { vibrationActuator?: unknown }).vibrationActuator;
        setPad({
          id: first.id,
          axes: [...first.axes],
          buttons: first.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
          hasRumble: Boolean(actuator),
        });
      } else {
        setPad(null);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const testRumble = () => {
    const first = (navigator.getGamepads?.() ?? []).find(Boolean);
    const actuator = (first as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: unknown) => Promise<unknown> } }) | undefined)?.vibrationActuator;
    actuator?.playEffect?.('dual-rumble', {
      duration: 350,
      strongMagnitude: 0.85,
      weakMagnitude: 0.55,
    }).catch(() => {});
  };

  const renderStick = (label: string, x: number, y: number) => {
    const dzRadius = deadzone * 48;
    const dotX = 56 + x * 44;
    const dotY = 56 + y * 44;
    const active = Math.hypot(x, y) >= deadzone;
    return (
      <div className="flex flex-col items-center gap-2 bg-[#0d1117] border border-white/10 rounded-2xl p-4">
        <span className="text-xs font-semibold text-[#9aa4b8]">{label}</span>
        <svg width={112} height={112} viewBox="0 0 112 112">
          <circle cx={56} cy={56} r={48} fill="#161b24" stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} />
          <line x1={8} y1={56} x2={104} y2={56} stroke="rgba(255,255,255,0.08)" />
          <line x1={56} y1={8} x2={56} y2={104} stroke="rgba(255,255,255,0.08)" />
          <circle
            cx={56}
            cy={56}
            r={dzRadius}
            fill="rgba(245, 158, 11, 0.14)"
            stroke="rgba(245, 158, 11, 0.6)"
            strokeDasharray="3 2"
          />
          <circle cx={dotX} cy={dotY} r={7} fill={active ? '#22c55e' : '#94a3b8'} />
        </svg>
        <div className="text-[11px] font-mono text-[#b4bcc8]">
          X: {x.toFixed(2)} • Y: {y.toFixed(2)}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#15191e] border border-white/10 rounded-2xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Gamepad2 className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="font-semibold text-sm text-white">
              {pad ? pad.id : 'No physical controller detected'}
            </div>
            <div className="text-xs text-[#9aa4b8]">
              {pad
                ? 'Move sticks or press any button to inspect live input.'
                : 'Connect a DualSense, DualShock 4, or Xbox controller via USB/Bluetooth and press any button.'}
            </div>
          </div>
        </div>
        {pad?.hasRumble && (
          <button type="button" onClick={testRumble} className="psbox-btn text-xs">
            <Vibrate className="w-4 h-4 text-emerald-400" />
            Test Rumble
          </button>
        )}
      </div>

      <div>
        <div className="flex justify-between text-xs text-[#b4bcc8] mb-1.5">
          <span>Stick Deadzone</span>
          <span className="font-mono font-semibold text-white">{Math.round(deadzone * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.35}
          step={0.01}
          value={deadzone}
          onChange={(e) => onDeadzoneChange(Number(e.target.value))}
          className="w-full accent-[#107c10]"
        />
      </div>

      {pad && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {renderStick('Left Stick', pad.axes[0] ?? 0, pad.axes[1] ?? 0)}
            {renderStick('Right Stick', pad.axes[2] ?? 0, pad.axes[3] ?? 0)}
            <div className="col-span-2 bg-[#0d1117] border border-white/10 rounded-2xl p-4 flex flex-col justify-center gap-4">
              <div>
                <div className="flex justify-between text-xs text-[#b4bcc8] mb-1">
                  <span>Left Trigger (L2 / LT)</span>
                  <span className="font-mono">{Math.round((pad.buttons[6]?.value ?? 0) * 100)}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${(pad.buttons[6]?.value ?? 0) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#b4bcc8] mb-1">
                  <span>Right Trigger (R2 / RT)</span>
                  <span className="font-mono">{Math.round((pad.buttons[7]?.value ?? 0) * 100)}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${(pad.buttons[7]?.value ?? 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {pad.buttons.slice(0, BUTTON_NAMES.length).map((b, i) => (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  b.pressed
                    ? 'bg-emerald-500 text-black border-emerald-400'
                    : 'bg-white/5 text-[#9aa4b8] border-white/10'
                }`}
              >
                {BUTTON_NAMES[i]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
