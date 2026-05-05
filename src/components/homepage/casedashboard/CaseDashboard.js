import React, { useRef, useState } from "react";
import Topbar from "./topbar";
import Sidepanel from "./sidepanel";
import Midsection from "./midsection";
import RightSection from "./rightsection";

function CaseDashboard() {
  const [images, setImages] = React.useState([]);
  const [selectedImage, setSelectedImage] = useState();

  const fileInputRef = useRef(null);

  // Handler for file input change (used by both Topbar and Sidepanel)
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = null; // Reset input
  };

  // Handler to trigger file input dialog
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: "black",
        display: "flex",
        flexDirection: "column",
        padding: "20px 40px",
        gap: "18px",
        boxSizing: "border-box",
      }}
    >
      <Topbar onAddScanClick={handleUploadClick} />
      <div
        className="case-dashboard-container"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "28px",
          width: "100%",
        }}
      >
        <Sidepanel
          images={images}
          onUploadClick={handleUploadClick}
          onImageUpload={handleImageUpload}
          fileInputRef={fileInputRef}
          numBoxes={images.length}
          onSelectImage={setSelectedImage}
        />
        <Midsection selectedImage={selectedImage} />
        <div style={{ width: "603px", maxWidth: "503px", height: "100%" }}>
          <RightSection />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />
    </div>
  );
}

export default CaseDashboard;
