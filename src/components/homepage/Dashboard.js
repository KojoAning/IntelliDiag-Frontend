import Appbar from "./appbar/appbar";
import Maincontent from "./maincontent/Maincontent";

function Dashboard() {
  return (
    <div
      style={{
        margin: 0,
        padding: 0, // No padding here
        height: "100vh",
        backgroundColor: "black",
        width: "100vw",
        // gap: "40px",
        // overflow: "hidden", // Hide any overflow
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "28px 33px", // Inner padding here
          width: "100%",
          height: "100vh",
  
          boxSizing: "border-box", // Ensures padding doesn't exceed 100%
          overflowY: "auto", // Optional: scroll if content inside is too tall
        }}
      >
        <Appbar />
        <Maincontent />
      
      </div>
    </div>
  );
}

export default Dashboard;
