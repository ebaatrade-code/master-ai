import HeroActions from "@/components/HeroActions";

export default function Hero() {
  return (
    <section className="...">
      <div className="...">
        <h1 className="...">...</h1>
        <p className="...">...</p>

        {/* ✅ ЭНЭ НЬ login хийсэн үед "Нэвтрэх"-ийг автоматаар алга болгоно */}
        <HeroActions />
      </div>
    </section>
  );
}
