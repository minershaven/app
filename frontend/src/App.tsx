import { Routes, Route, Link } from "react-router-dom";
import Home from "@/pages/Home";
import Coin from "@/pages/Coin";
import Miner from "@/pages/Miner";
import Admin from "@/pages/Admin";
import Layout from "@/components/Layout";

function NotFound() {
  return (
    <Layout>
      <div data-testid="not-found" className="py-20 font-mono">
        <div className="text-5xl font-bold text-neon">404</div>
        <p className="mt-2 text-muted-foreground">ERR_ROUTE_NOT_FOUND</p>
        <Link to="/" className="mt-6 inline-block text-sm text-neon underline">back to overview</Link>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/coin/:symbol" element={<Coin />} />
      <Route path="/miner/:wallet" element={<Miner />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
