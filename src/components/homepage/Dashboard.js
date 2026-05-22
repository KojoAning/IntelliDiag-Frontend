import Appbar from "./appbar/appbar";
import Maincontent from "./maincontent/Maincontent";

function Dashboard() {
  return (
    <div className="m-0 p-0 h-screen bg-black w-screen">
      <div className="flex flex-col px-[33px] py-[28px] w-full h-screen box-border overflow-hidden">
        <Appbar />
        <Maincontent />
      </div>
    </div>
  );
}

export default Dashboard;
