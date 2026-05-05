import React from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const ActionButton = styled.button`
  background-color: #0694fb;
  border-radius: 0.625rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 8rem;
  height: 40px;
  text-align: center;
  border: none;
  margin: 0;

  &:hover {
    background-color: #0578d1;
    transform: translateY(-2px);
  }
`;

const ButtonText = styled.p`
  margin: 0;
  color: white;
  font-weight: 400;
  font-size: 0.985rem;
`;

function Topbar({ onAddScanClick }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "60px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: "15px",
          backgroundColor: "#0D0D0D",
          padding: "27px 15px",
          margin: "auto",
          width: "fit-content",
        }}
      >
        <img src="intellidiag.png" alt="logo" height="auto" width="153px" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: "#0D0D0D",
          justifyContent: "space-between",
          width: "100%",
          padding: "15px 27px",
          boxSizing: "border-box",
          borderRadius: "15px",
        }}
      >gggg
        <div
          style={{
            width: "content",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "36px",
          }}
        >
          <ActionButton onClick={onAddScanClick}>
            <ButtonText>Add Scans</ButtonText>
          </ActionButton>
          <ActionButton
            style={{
              backgroundColor: "#0AB563",
              border: "none",
            }}
            onClick={() => navigate("/new-case")}
          >
            <ButtonText>Invite Collaborators</ButtonText>
          </ActionButton>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "44px",
                height: "44px",
                borderRadius: "200px",
                backgroundColor: "#0694FB",
                color: "#0694FB",
                fontSize: "16px",
              }}
            ></div>
            <div
              style={{
                display: "flex",
                height: "fit-content",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <p
                style={{
                  margin: "0",
                  fontSize: "13px",
                  fontWeight: "400",
                  color: "#858585",
                }}
              >
                Product Manager
              </p>
              <p
                style={{
                  margin: "0",
                  fontSize: "16px",
                  fontWeight: "400",
                  color: "#FFFFFF",
                }}
              >
                Andrew Smith
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Topbar;