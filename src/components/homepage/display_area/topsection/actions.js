import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

const ActionsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 2.5rem;
  width: 100%;
  max-width: 30.3125rem; /* 485px */
  height: 100%;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 1.5rem;
    justify-content: flex-start;
  }
`;

const ActionButton = styled.button`
  background-color: #0694fb;
  border-radius: 0.625rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 8rem;
  text-align: center;
  border: none;

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

const StatContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.div`
  background-color: rgba(6, 148, 251, 0.17);
  display: inline-flex;
  border-radius: 0.6875rem;
  padding: 0.375rem 0.5625rem;
  margin-bottom: 0.3125rem;
`;

const LabelText = styled.p`
  margin: 0;
  font-size: 0.75rem;
  color: rgba(6, 148, 251, 1);
  font-weight: 500;
`;

const StatValue = styled.h1`
  margin: 0;
  padding-left: 0.625rem;
  font-size: 1.875rem;
  font-weight: 400;
  color: rgb(255, 255, 255);
`;


const Actions = ({
  buttonText = "Create New Case",
  stats = [
    { label: "Today's Inference", value: 56 },
    { label: "Average Inference Time", value: "56s" },
  ],
}) => {
  const navigate = useNavigate();
  return (
    <ActionsContainer>
      <ActionButton onClick={() => navigate("/new-case")}>
        <ButtonText>{buttonText}</ButtonText>
      </ActionButton>

      {stats.map((stat, index) => (
        <StatContainer key={index}>
          <StatLabel>
            <LabelText>{stat.label}</LabelText>
          </StatLabel>
          <StatValue>{stat.value}</StatValue>
        </StatContainer>
      ))}
    </ActionsContainer>
  );
};

Actions.propTypes = {
  buttonText: PropTypes.string,
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
};

export default Actions;
