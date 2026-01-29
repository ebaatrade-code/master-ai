"use client";

type Props = {
  level: number;
};

const steps = [
  { level: 1, title: "Beginner", desc: "Суурь ойлголт" },
  { level: 2, title: "Creator", desc: "Хийж эхэлнэ" },
  { level: 3, title: "Pro", desc: "Чадвар тогтворжино" },
  { level: 4, title: "Master", desc: "Системтэй өснө" },
];

export default function RoadmapStrip({ level }: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/85">Таны хөгжлийн зам</div>
          <div className="mt-1 text-xs text-white/50">
            Түвшин ахих тусам илүү хүчтэй багцууд “unlock” хийгдэнэ.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white/75">
          Level {level}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {steps.map((s) => {
          const active = level === s.level;
          const done = level > s.level;

          return (
            <div
              key={s.level}
              className={[
                "rounded-2xl border p-4 transition",
                done
                  ? "border-white/10 bg-white/5"
                  : active
                  ? "border-orange-400/40 bg-orange-500/10 shadow-[0_0_24px_rgba(249,115,22,0.18)]"
                  : "border-white/10 bg-black/20",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-white/90">
                  {s.title}
                </div>
                <div className="text-xs text-white/60">
                  {done ? "✅" : active ? "🔥" : "🔒"}
                </div>
              </div>
              <div className="mt-1 text-xs text-white/55">{s.desc}</div>
              <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-orange-500"
                  style={{
                    width: done ? "100%" : active ? "70%" : "20%",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
