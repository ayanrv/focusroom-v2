import { useEffect } from "react";
import { supabase } from "./lib/supabase";

function App() {
  useEffect(() => {
    async function testSupabase() {
      const { data, error } = await supabase.auth.getSession();

      console.log("Supabase connected");
      console.log("Session:", data.session);
      console.log("Error:", error);
    }

    testSupabase();
  }, []);

  return <h1>FocusRoom V2</h1>;
}

export default App;