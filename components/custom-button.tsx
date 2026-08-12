import Image from "next/image"

interface CustomButtonProps {
    disable: boolean;
    handleFN: () => void;
    btnTitle: string;
    isLoading?: boolean;
}

const CustomButton = ({ disable, handleFN, btnTitle, isLoading = false }: CustomButtonProps) => {
    const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "";

    return (
        <button
            disabled={disable}
            onClick={handleFN}
            className={`
              group
              ${disable ? "bg-white text-black opacity-100" : "bg-foreground text-background hover:bg-foreground/90"}
              border border-[#2a2a2a] 
              px-4 py-2 rounded-lg 
              flex justify-center items-center
              text-sm transition-colors 
              ${disable ? "!cursor-not-allowed" : "!cursor-pointer"} 
              w-[199px] h-[40px]
            `}
        >
            {isLoading ? (
                <div className="flex items-center gap-2">
                    <div className="relative w-[20px] h-[20px]">
                        <Image
                            src={`${assetPrefix}/assets/gif/star-ai-loader.gif`}
                            alt="Loading"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                    <span className="text-black">Loading...</span>
                </div>
            ) : (
                <span className="flex items-center gap-2">
                    <span className="transition-transform duration-200 group-hover:-translate-x-1">
                        {btnTitle}
                    </span>

                    <span className="inline-block origin-left transition-transform duration-200 group-hover:translate-x-1 group-hover:scale-x-180">
                        →
                    </span>
                </span>
            )}
        </button>
    );
};

export default CustomButton;
